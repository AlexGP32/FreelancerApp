using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Security.Claims;
using FreelancerApp.Server.Models;
using Microsoft.AspNetCore.Authorization;

namespace FreelancerApp.Server.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class AngajariController : ControllerBase
    {
        private readonly string _connectionString = string.Empty;
        private readonly IConfiguration _configuration;

        public AngajariController(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("LicentaBaza");
            _configuration = configuration;
        }

        // Extracts ID from JWT token (passed via Authorize middleware)
        private int? GetIdUtilizatorCurent()
        {
            var claim = User.FindFirst("id");
            if (claim == null || !int.TryParse(claim.Value, out int id))
            {
                return null;
            }
            return id;
        }

        // Returns ongoing jobs for a Freelancer (authorized for payment, but work not yet delivered)
        [HttpGet("freelancer/active")]
        public async Task<IActionResult> GetAngajariActive()
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null) return Unauthorized(new { eroare = "Token invalid." });

            try
            {
                var angajari = new List<object>();
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string sql = @"SELECT a.id_angajare, a.titlu, a.descriere, a.data_angajarii
                    FROM ""ANGAJARE"" a 
                    JOIN ""FREELANCER"" f ON a.id_freelancer = f.id_freelancer
                    WHERE f.id_utilizator = @idFreelancer
                    AND a.status_plata ='Autorizat'
                    AND a.link IS NULL"; // 'link' is the deliverable URL. As long as it is NULL, the project is still in progress.

                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@idFreelancer", idUserCurent.Value);
                        using var reader = await cmd.ExecuteReaderAsync();
                        while (await reader.ReadAsync())
                        {
                            angajari.Add(new
                            {
                                idAngajare = reader.GetInt32(0),
                                titlu = reader.GetString(1),
                                descriere = reader.GetString(2),
                                dataAngajarii = reader.GetDateTime(3)
                            });
                        }
                    }
                }
                return Ok(angajari);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = "Eroare la aducerea angajărilor: " + ex.Message });
            }
        }

        // The status parameter dictates whether the Client wants jobs 'In Evaluare' (In Review) or completed ones.
        [HttpGet("client/lucrari")]
        public async Task<IActionResult> GetLucrari([FromQuery] string status)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null) return Unauthorized(new { eroare = "Token invalid." });

            try
            {
                var lucrari = new List<object>();
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    // The OR condition handles the fact that refunds (Disputes) also fall under completed projects.
                    string sql = @"SELECT a.id_angajare, a.titlu, a.descriere, a.link, a.data_angajarii, u.nume as numeFreelancer, p.titlu as titluProiect, pc.suma, f.id_freelancer
                    FROM ""ANGAJARE"" a
                    JOIN ""FREELANCER"" f ON a.id_freelancer = f.id_freelancer
                    JOIN ""UTILIZATOR"" u ON f.id_utilizator = u.id_utilizator
                    JOIN ""ACTIVITATE"" act ON a.id_activitate = act.id_activitate
                    JOIN ""PROIECT"" p ON act.id_proiect = p.id_proiect
                    JOIN ""CLIENT"" c on p.id_client = c.id_client
                    JOIN ""PLATA_CONDITIONATA"" pc on pc.id_autorizare_plata = a.id_autorizare_plata
                    WHERE c.id_utilizator = @idClient
                    AND (a.status_plata = @status OR (@status = 'Finalizat' AND a.status_plata = 'Rambursat'))
                    AND (@status != 'In Evaluare' OR a.link IS NOT NULL)";
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@idClient", idUserCurent.Value);
                        cmd.Parameters.AddWithValue("@status", status);
                        using var reader = await cmd.ExecuteReaderAsync();
                        while (await reader.ReadAsync())
                        {
                            lucrari.Add(new
                            {
                                idAngajare = reader.GetInt32(0),
                                titlu = reader.GetString(1),
                                descriere = reader.GetString(2),
                                link = reader.IsDBNull(3) ? "" : reader.GetString(3),
                                DataAngajarii = reader.GetDateTime(4),
                                numeFreelancer = reader.GetString(5),
                                titluProiect = reader.GetString(6),
                                suma = reader.GetDecimal(7),
                                idFreelancer = reader.GetInt32(8)
                            });
                        }
                    }
                }
                return Ok(lucrari);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = "Eroare la aducerea lucrărilor: " + ex.Message });
            }
        }

        // Similar to the client function, used by a Freelancer to display work history (Freelancer Dashboard)
        [HttpGet("freelancer/finalizate")]
        public async Task<IActionResult> GetAngajariFinalizateFreelancer()
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null) return Unauthorized(new { eroare = "Token invalid." });

            try
            {
                var angajari = new List<object>();
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string sql = @"SELECT a.id_angajare, a.titlu, a.descriere, a.data_angajarii, c.id_client
                    FROM ""ANGAJARE"" a 
                    JOIN ""FREELANCER"" f ON a.id_freelancer = f.id_freelancer
                    JOIN ""ACTIVITATE"" act ON a.id_activitate = act.id_activitate
                    JOIN ""PROIECT"" p ON act.id_proiect = p.id_proiect
                    JOIN ""CLIENT"" c ON p.id_client = c.id_client
                    WHERE f.id_utilizator = @idFreelancer
                    AND a.status_plata IN('Finalizat' , 'Rambursat')";
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@idFreelancer", idUserCurent.Value);
                        using var reader = await cmd.ExecuteReaderAsync();
                        while (await reader.ReadAsync())
                        {
                            angajari.Add(new
                            {
                                idAngajare = reader.GetInt32(0),
                                titlu = reader.GetString(1),
                                descriere = reader.GetString(2),
                                DataAngajarii = reader.GetDateTime(3),
                                idClient = reader.GetInt32(4)
                            });
                        }
                    }
                }
                return Ok(angajari);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = "Eroare: " + ex.Message });
            }
        }

        // Contacts PayPal to Capture funds that were only Authorized (locked) at the beginning of the job
        [HttpPost("{idAngajare}/elibereaza-plata")]
        public async Task<IActionResult> ElibereazaPlata(int idAngajare)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null) return Unauthorized(new { eroare = "Token invalid." });

            try
            {
                string idAutorizare = "";
                int idPlata = 0;
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    // 1. Retrieves the Authorization (PayPal Auth ID) based on the job ID from the local database
                    string sqlGet = @"SELECT a.id_autorizare_plata, pc.id_plata, c.id_utilizator
                    FROM ""ANGAJARE"" a
                    JOIN ""ACTIVITATE"" act ON a.id_activitate = act.id_activitate
                    JOIN ""PROIECT"" p ON act.id_proiect = p.id_proiect
                    JOIN ""CLIENT"" c ON p.id_client = c.id_client
                    JOIN ""PLATA_CONDITIONATA"" pc ON pc.id_proiect = act.id_proiect
                    WHERE a.id_angajare = @idAngajare";
                    int idUtilizatorClient = 0;
                    using (var cmd = new NpgsqlCommand(sqlGet, connection))
                    {
                        cmd.Parameters.AddWithValue("@idAngajare", idAngajare);
                        using var reader = await cmd.ExecuteReaderAsync();
                        if (await reader.ReadAsync())
                        {
                            idAutorizare = reader.GetString(0);
                            idPlata = reader.GetInt32(1);
                            idUtilizatorClient = reader.GetInt32(2);
                        }
                        else
                        {
                            return NotFound(new { eroare = "Angajarea nu a fost găsită." });
                        }
                    }

                    // Prevents other entities (e.g., other clients/freelancers) from releasing funds via URL spoofing
                    if (idUtilizatorClient != idUserCurent.Value)
                    {
                        return Forbid();
                    }

                    // 2. API Authentication with PayPal servers
                    var clientId = _configuration["PayPal:ClientId"];
                    var secret = _configuration["PayPal:Secret"];
                    var baseUrl = _configuration["PayPal:BaseUrl"];
                    using var httpClient = new HttpClient();
                    var authBytes = Encoding.ASCII.GetBytes($"{clientId}:{secret}");
                    httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
                    var tokenReq = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v1/oauth2/token");
                    tokenReq.Content = new StringContent("grant_type=client_credentials", Encoding.UTF8, "application/x-www-form-urlencoded");
                    var tokenRes = await httpClient.SendAsync(tokenReq);
                    var tokenJson = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(
                        await tokenRes.Content.ReadAsStringAsync());
                    var accessToken = tokenJson.GetProperty("access_token").GetString();

                    // 3. Sends the "Capture" command using the PayPal access token
                    httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                    var captureRes = await httpClient.PostAsync($"{baseUrl}/v2/payments/authorizations/{idAutorizare}/capture",
                    new StringContent("{}", Encoding.UTF8, "application/json"));

                    if (!captureRes.IsSuccessStatusCode)
                    {
                        var err = await captureRes.Content.ReadAsStringAsync();
                        return BadRequest(new { eroare = "Eroare PayPal la capturare", detalii = err });
                    }

                    // 4. Updates database status to "Finalizat" (Transaction used to maintain data consistency)
                    using var transaction = await connection.BeginTransactionAsync();
                    try
                    {
                        using (var cmd = new NpgsqlCommand(@"UPDATE ""ANGAJARE"" SET status_plata = 'Finalizat' 
                        WHERE id_angajare = @idAngajare", connection, transaction))
                        {
                            cmd.Parameters.AddWithValue("@idAngajare", idAngajare);
                            await cmd.ExecuteNonQueryAsync();
                        }
                        using (var cmd = new NpgsqlCommand(
                            @"UPDATE ""PLATA_CONDITIONATA"" SET status = 'Finalizat'
                            WHERE id_plata = @idPlata", connection, transaction))
                        {
                            cmd.Parameters.AddWithValue("@idPlata", idPlata);
                            await cmd.ExecuteNonQueryAsync();
                        }

                        // Checks if this contract was the last one in that parent PROJECT; if so, closes the project completely.
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
                }
                return Ok(new { mesaj = "Plata a fost eliberată cu succes către freelancer." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = "Eroare la eliberarea plății: " + ex.Message });
            }
        }

        // Endpoint used by a Freelancer to submit the work (Github/GDrive link) to the client for evaluation
        [HttpPost("{idAngajare}/predare")]
        public async Task<IActionResult> PredaLucrare(int idAngajare, [FromBody] PredareRequest request)
        {
            if (string.IsNullOrEmpty(request.Link))
            {
                return BadRequest(new { eroare = "Link-ul nu poate fi gol." });
            }
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null) return Unauthorized(new { eroare = "Token invalid." });

            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    // Ensure only the freelancer who won this specific contract can submit documentation
                    string sqlCheck = @"SELECT f.id_utilizator
                    FROM ""ANGAJARE"" a
                    JOIN ""FREELANCER"" f ON a.id_freelancer = f.id_freelancer
                    WHERE a.id_angajare = @idAngajare";
                    using (var cmdCheck = new NpgsqlCommand(sqlCheck, connection))
                    {
                        cmdCheck.Parameters.AddWithValue("@idAngajare", idAngajare);
                        var rezultat = await cmdCheck.ExecuteScalarAsync();
                        if (rezultat == null)
                        {
                            return NotFound(new { eroare = "Angajarea nu a fost găsită." });
                        }
                        if (Convert.ToInt32(rezultat) != idUserCurent.Value)
                        {
                            return Forbid();
                        }
                    }

                    // Sets the status to "In Evaluare" (In Review), unlocking the "Release Payment" actions for the client
                    string sqlUpdate = @"UPDATE ""ANGAJARE""
                    SET link = @link, status_plata = 'In Evaluare'
                    WHERE id_angajare = @IdAngajare";
                    using (var cmd = new NpgsqlCommand(sqlUpdate, connection))
                    {
                        cmd.Parameters.AddWithValue("@link", request.Link);
                        cmd.Parameters.AddWithValue("@IdAngajare", idAngajare);
                        await cmd.ExecuteNonQueryAsync();
                    }
                }
                return Ok(new { mesaj = "Lucrarea a fost predată cu succes." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = "Eroare la predare: " + ex.Message });
            }
        }

        // Called by the client when unsatisfied with the submitted link, refusing to release PayPal funds
        [HttpPost("{idAngajare}/disputa")]
        public async Task<IActionResult> LanseazaDisputa(int idAngajare, [FromBody] DisputaRequest request)
        {
            if (string.IsNullOrEmpty(request.Motiv))
            {
                return BadRequest(new { eroare = "Motivul disputei este obligatoriu" });
            }
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null) return Unauthorized(new { eroare = "Token invalid." });

            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    // Identifies payment links so funds cannot be auto-captured if under dispute.
                    string sqlGetPlata = @"SELECT pc.id_plata, a.link, c.id_utilizator
                    FROM ""ANGAJARE"" a
                    JOIN ""ACTIVITATE"" act ON a.id_activitate = act.id_activitate
                    JOIN ""PROIECT"" p ON act.id_proiect = p.id_proiect
                    JOIN ""CLIENT"" c ON p.id_client = c.id_client
                    JOIN ""PLATA_CONDITIONATA"" pc ON pc.id_autorizare_plata = a.id_autorizare_plata
                    WHERE a.id_angajare = @idAngajare";

                    int idPlata = 0;
                    string link = "";
                    int idUtilizatorClient = 0;

                    using (var cmd = new NpgsqlCommand(sqlGetPlata, connection))
                    {
                        cmd.Parameters.AddWithValue("@idAngajare", idAngajare);
                        using var reader = await cmd.ExecuteReaderAsync();
                        if (await reader.ReadAsync())
                        {
                            idPlata = reader.GetInt32(0);
                            link = reader.IsDBNull(1) ? "" : reader.GetString(1);
                            idUtilizatorClient = reader.GetInt32(2);
                        }
                        else
                        {
                            return NotFound(new { eroare = "Angajarea nu a fost găsită." });
                        }
                    }

                    if (idUtilizatorClient != idUserCurent.Value)
                    {
                        return Forbid();
                    }

                    // Prevents spamming the Dispute system via repeated HTTP requests
                    string sqlCheck = @"SELECT COUNT(*)
                    FROM ""DISPUTA""
                    WHERE id_plata = @idPlata";
                    using (var cmd = new NpgsqlCommand(sqlCheck, connection))
                    {
                        cmd.Parameters.AddWithValue(@"idPlata", idPlata);
                        long count = (long)await cmd.ExecuteScalarAsync();
                        if (count > 0)
                        {
                            return BadRequest(new { eroare = "Există deja o dispută deschisă pentru această angajare." });
                        }
                    }

                    // Registers the new ticket in the system to be picked up by a "Expert_Legal"
                    string sqlInsert = @"INSERT INTO ""DISPUTA"" (id_plata, motiv, data_deschiderii, status, link_livrabil) VALUES (@idPlata, @motiv, @data, 'Deschisă' , @link)";
                    using (var cmd = new NpgsqlCommand(sqlInsert, connection))
                    {
                        cmd.Parameters.AddWithValue("@idPlata", idPlata);
                        cmd.Parameters.AddWithValue("@motiv", request.Motiv);
                        cmd.Parameters.AddWithValue("@data", DateTime.Now);
                        cmd.Parameters.AddWithValue("@link", link);
                        await cmd.ExecuteNonQueryAsync();
                    }

                    string sqlUpdate = @"UPDATE ""ANGAJARE"" SET status_plata = 'Disputat'
                    WHERE id_angajare = @idAngajare";
                    using (var cmd = new NpgsqlCommand(sqlUpdate, connection))
                    {
                        cmd.Parameters.AddWithValue("@idAngajare", idAngajare);
                        await cmd.ExecuteNonQueryAsync();
                    }
                }
                return Ok(new { mesaj = "Disputa a fost lansată cu succes." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = "Eroare la lansarea disputei: " + ex.Message });
            }
        }
    }
}