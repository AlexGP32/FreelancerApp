using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using FreelancerApp.Server.Models;
using Microsoft.AspNetCore.Authorization;
using System.Data;

namespace FreelancerApp.Server.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class DisputeController : ControllerBase
    {
        private readonly string _connectionString = string.Empty;
        private readonly IConfiguration _configuration;
        private readonly ILogger<DisputeController> _logger;

        public DisputeController(IConfiguration configuration, ILogger<DisputeController> logger)
        {
            _connectionString = configuration.GetConnectionString("LicentaBaza");
            _configuration = configuration;
            _logger = logger;
        }

        private int? GetIdUtilizatorCurent()
        {
            var claim = User.FindFirst("sub") ?? User.FindFirst("id");
            if (claim == null || !int.TryParse(claim.Value, out int id))
            {
                return null;
            }
            return id;
        }

        private string? GetRolCurent()
        {
            return User.FindFirst("rol")?.Value;
        }

        [HttpGet("deschise")]
        public async Task<IActionResult> GetDisputeDeschise()
        {
            if (GetRolCurent() != "Expert_Legal")
            {
                return Forbid();
            }

            try
            {
                var dispute = new List<object>();
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string sql = @"SELECT d.id_disputa, d.motiv, d.data_deschiderii, d.link_livrabil, a.descriere as sarcina, p.titlu
                    FROM ""DISPUTA"" d
                    JOIN ""PLATA_CONDITIONATA"" pc ON d.id_plata = pc.id_plata
                    JOIN  ""PROIECT"" p ON pc.id_proiect = p.id_proiect
                    JOIN ""ANGAJARE"" a ON a.id_autorizare_plata = pc.id_autorizare_plata
                    WHERE d.status = 'Deschisă'";
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                dispute.Add(new
                                {
                                    id_disputa = reader.GetInt32(0),
                                    motiv = reader.GetString(1),
                                    data_deschiderii = reader.GetDateTime(2),
                                    linkLivrabil = reader.IsDBNull(3) ? "" : reader.GetString(3),
                                    sarcina = reader.IsDBNull(4) ? "" : reader.GetString(4),
                                    titlu = reader.GetString(5)
                                });
                            }
                        }
                    }
                    return Ok(dispute);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Eroare la aducerea disputelor deschise.");
                return StatusCode(500, new { eroare = "Eroare la aducerea disputelor." });
            }
        }

        [HttpPost("{idDisputa}/rezolva")]
        public async Task<IActionResult> RezolvaDisputa(int idDisputa, [FromBody] RezolvareRequest request)
        {
            var idUtilizatorNullable = GetIdUtilizatorCurent();
            if (idUtilizatorNullable == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }
            int idUtilizator = idUtilizatorNullable.Value;
            if (GetRolCurent() != "Expert_Legal")
            {
                return Forbid();
            }

            if (string.IsNullOrEmpty(request?.Castigator) || (request.Castigator != "Client" && request.Castigator != "Freelancer"))
            {
                return BadRequest(new { eroare = "Decizia trebuie să fie 'Client' sau 'Freelancer'." });
            }

            int idExpert;
            using (var connection = new NpgsqlConnection(_connectionString))
            {
                await connection.OpenAsync();
                string sqlExpert = @"SELECT id_expert FROM ""EXPERT_LEGAL"" WHERE id_utilizator = @idUtilizator";
                using (var cmd = new NpgsqlCommand(sqlExpert, connection))
                {
                    cmd.Parameters.AddWithValue("@idUtilizator", idUtilizator);
                    var result = await cmd.ExecuteScalarAsync();
                    if (result == null)
                    {
                        return BadRequest(new { eroare = "Expertul legal nu a fost găsit." });
                    }
                    idExpert = Convert.ToInt32(result);
                }
            }

            try
            {
                string idAutorizare = "";
                int idPlata = 0;
                int idAngajare = 0;
                string statusDisputa = "";
                using var connection = new NpgsqlConnection(_connectionString);
                await connection.OpenAsync();
                using var transaction = await connection.BeginTransactionAsync();
                try
                {
                    string sqlLock = @"SELECT d.status FROM ""DISPUTA"" d WHERE d.id_disputa = @idDisputa FOR UPDATE";
                    using (var cmdLock = new NpgsqlCommand(sqlLock, connection, transaction))
                    {
                        cmdLock.Parameters.AddWithValue("@idDisputa", idDisputa);
                        var result = await cmdLock.ExecuteScalarAsync();
                        if (result == null)
                        {
                            await transaction.RollbackAsync();
                            return NotFound(new { eroare = "Disputa nu a fost găsită." });
                        }
                        statusDisputa = (string)result;
                    }

                    if (statusDisputa != "Deschisă")
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { eroare = "Disputa a fost deja soluționată." });
                    }
                    string sqlVerifica = @"SELECT COUNT(*) FROM ""DISPUTA"" d
                    JOIN ""PLATA_CONDITIONATA"" pc ON d.id_plata = pc.id_plata
                    JOIN ""PROIECT"" p ON pc.id_proiect = p.id_proiect
                    JOIN ""CLIENT"" c ON c.id_client = p.id_client
                    JOIN ""ANGAJARE"" a ON a.id_autorizare_plata = pc.id_autorizare_plata
                    JOIN ""FREELANCER"" f ON f.id_freelancer = a.id_freelancer
                    WHERE d.id_disputa = @idDisputa
                    AND (c.id_utilizator = @idUtilizator OR f.id_utilizator = @idUtilizator)";
                    using (var cmd = new NpgsqlCommand(sqlVerifica, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@idDisputa", idDisputa);
                        cmd.Parameters.AddWithValue("@idUtilizator", idUtilizator);
                        var count = (long)await cmd.ExecuteScalarAsync();
                        if (count > 0)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new { eroare = "Nu poți soluționa o dispută în care ești implicat." });
                        }
                    }
                    string sqlGet = @"SELECT pc.id_autorizare_plata, pc.id_plata, a.id_angajare
                    FROM ""DISPUTA"" d
                    JOIN ""PLATA_CONDITIONATA"" pc ON d.id_plata = pc.id_plata
                    JOIN ""ANGAJARE"" a ON a.id_autorizare_plata = pc.id_autorizare_plata
                    WHERE d.id_disputa = @idDisputa";
                    using (var cmd = new NpgsqlCommand(sqlGet, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@idDisputa", idDisputa);
                        using var reader = await cmd.ExecuteReaderAsync();
                        if (await reader.ReadAsync())
                        {
                            idAutorizare = reader.GetString(0);
                            idPlata = reader.GetInt32(1);
                            idAngajare = reader.GetInt32(2);
                        }
                    }
                    if (string.IsNullOrEmpty(idAutorizare))
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { eroare = "Nu s-a găsit nicio autorizare de plată pentru această dispută." });
                    }
                    var clientId = _configuration["PayPal:ClientId"];
                    var secret = _configuration["PayPal:Secret"];
                    var baseUrl = _configuration["PayPal:BaseUrl"];
                    using var httpClient = new HttpClient();
                    var authBytes = Encoding.ASCII.GetBytes($"{clientId}:{secret}");
                    httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
                    var tokenReq = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v1/oauth2/token");
                    tokenReq.Content = new StringContent("grant_type=client_credentials", Encoding.UTF8, "application/x-www-form-urlencoded");
                    var tokenRes = await httpClient.SendAsync(tokenReq);
                    if (!tokenRes.IsSuccessStatusCode)
                    {
                        await transaction.RollbackAsync();
                        _logger.LogError("Autentificare PayPal eșuată cu status {Status}", tokenRes.StatusCode);
                        return StatusCode(502, new { eroare = "Nu s-a putut contacta procesatorul de plăți." });
                    }
                    var tokenJson = JsonSerializer.Deserialize<JsonElement>(await tokenRes.Content.ReadAsStringAsync());
                    var accessToken = tokenJson.GetProperty("access_token").GetString();
                    httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

                    HttpResponseMessage paypalRes;
                    if (request.Castigator == "Freelancer")
                    {
                        paypalRes = await httpClient.PostAsync($"{baseUrl}/v2/payments/authorizations/{idAutorizare}/capture",
                        new StringContent("{}", Encoding.UTF8, "application/json"));
                    }
                    else
                    {
                        paypalRes = await httpClient.PostAsync($"{baseUrl}/v2/payments/authorizations/{idAutorizare}/void",
                        new StringContent("{}", Encoding.UTF8, "application/json"));
                    }
                    if (!paypalRes.IsSuccessStatusCode)
                    {
                        await transaction.RollbackAsync();
                        var eroarePaypal = await paypalRes.Content.ReadAsStringAsync();
                        _logger.LogError("Operațiune PayPal eșuată pentru disputa {IdDisputa}: {Eroare}", idDisputa, eroarePaypal);
                        return StatusCode(502, new { eroare = "Operațiunea de plată a eșuat, disputa nu a fost soluționată." });
                    }
                    string sqlUpdateDisputa = @"UPDATE ""DISPUTA"" 
                    SET status = 'Închisă', data_deciziei = @dataDeciziei, id_expert = @idExpert
                    WHERE id_disputa = @idDisputa";
                    using (var cmd = new NpgsqlCommand(sqlUpdateDisputa, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@idDisputa", idDisputa);
                        cmd.Parameters.AddWithValue("@dataDeciziei", DateTime.Now);
                        cmd.Parameters.AddWithValue("@idExpert", idExpert);
                        await cmd.ExecuteNonQueryAsync();
                    }

                    string statusPlata = request.Castigator == "Client" ? "Rambursat" : "Finalizat";
                    string sqlUpdatePlata = @"UPDATE ""PLATA_CONDITIONATA""
                    SET status = @status WHERE id_plata = @idPlata";
                    using (var cmd = new NpgsqlCommand(sqlUpdatePlata, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@status", statusPlata);
                        cmd.Parameters.AddWithValue("@idPlata", idPlata);
                        await cmd.ExecuteNonQueryAsync();
                    }

                    string sqlUpdateAngajare = @"UPDATE ""ANGAJARE""
                    SET status_plata = @status WHERE id_angajare = @idAngajare";
                    using (var cmd = new NpgsqlCommand(sqlUpdateAngajare, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@status", statusPlata);
                        cmd.Parameters.AddWithValue("@idAngajare", idAngajare);
                        await cmd.ExecuteNonQueryAsync();
                    }

                    string sqlVerificaProiect = @"UPDATE ""PROIECT"" p 
                    SET status = 'Finalizat'
                    WHERE p.id_proiect = (SELECT act.id_proiect
                    FROM ""ACTIVITATE"" act
                    JOIN ""ANGAJARE"" a ON a.id_activitate = act.id_activitate
                    WHERE a.id_angajare = @idAngajare
                    ) AND NOT EXISTS (SELECT 1 FROM ""ACTIVITATE"" act2 
                    LEFT JOIN ""ANGAJARE"" a2 ON act2.id_activitate = a2.id_activitate
                    WHERE act2.id_proiect = p.id_proiect
                    AND (
                        a2.id_angajare IS NULL OR
                        a2.status_plata NOT IN ('Finalizat' , 'Rambursat')
                    )
                )";
                    using (var cmd = new NpgsqlCommand(sqlVerificaProiect, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@idAngajare", idAngajare);
                        await cmd.ExecuteNonQueryAsync();
                    }

                    await transaction.CommitAsync();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }

                string mesajFinal = request.Castigator == "Client" ? "Banii au fost rambursați clientului." : "Banii au fost eliberați către freelancer.";
                return Ok(new { mesaj = "Disputa a fost soluționată. " + mesajFinal });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Eroare la soluționarea disputei {IdDisputa}.", idDisputa);
                return StatusCode(500, new { eroare = "Eroare la soluționare." });
            }
        }
    }
}