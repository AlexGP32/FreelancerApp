using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using FreelancerApp.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Npgsql;

namespace FreelancerApp.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PlatiController : ControllerBase
    {
        private readonly string clientId;
        private readonly string secret;
        private readonly string sandboxUrl;
        private readonly string _connectionString;

        public PlatiController(IConfiguration config)
        {
            clientId = config["PayPal:ClientId"];
            secret = config["PayPal:Secret"];
            sandboxUrl = config["PayPal:BaseUrl"];
            _connectionString = config.GetConnectionString("LicentaBaza");
        }

        private int? GetIdUtilizatorCurent()
        {
            var claim = User.FindFirst("id");
            if (claim == null || !int.TryParse(claim.Value, out int id))
            {
                return null;
            }
            return id;
        }

        private async Task<string> GetAccessToken()
        {
            using var client = new HttpClient();
            var authBytes = Encoding.ASCII.GetBytes($"{clientId}:{secret}");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
            var request = new HttpRequestMessage(HttpMethod.Post, $"{sandboxUrl}/v1/oauth2/token");
            request.Content = new StringContent("grant_type=client_credentials", Encoding.UTF8, "application/x-www-form-urlencoded");
            var response = await client.SendAsync(request);
            response.EnsureSuccessStatusCode();
            var jsonResponse = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<JsonElement>(jsonResponse);
            return result.GetProperty("access_token").GetString();
        }

        [HttpPost("CreeazaComanda")]
        public async Task<IActionResult> CreeazaComanda([FromBody] CreareComanda dto)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            decimal pretOferta = 0;
            string descriereOferta = string.Empty;

            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string sqlVerify = @"
                        SELECT c.id_utilizator, o.pret, a.titlu_activitate 
                        FROM ""OFERTA"" o
                        JOIN ""ACTIVITATE"" a ON o.id_activitate = a.id_activitate
                        JOIN ""PROIECT"" p ON a.id_proiect = p.id_proiect
                        JOIN ""CLIENT"" c ON p.id_client = c.id_client
                        WHERE o.id_oferta = @idOferta AND o.status = 'În Așteptare'";

                    using (var cmd = new NpgsqlCommand(sqlVerify, connection))
                    {
                        cmd.Parameters.AddWithValue("@idOferta", dto.IdOferta);
                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            if (await reader.ReadAsync())
                            {
                                var idProprietar = reader.GetInt32(0);
                                if (idProprietar != idUserCurent.Value)
                                {
                                    return Forbid();
                                }
                                pretOferta = reader.GetDecimal(1);
                                descriereOferta = reader.GetString(2);
                            }
                            else
                            {
                                return NotFound(new { eroare = "Oferta nu a fost găsită sau nu este validă." });
                            }
                        }
                    }
                }

                var accessToken = await GetAccessToken();
                using var client = new HttpClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                var orderRequest = new
                {
                    intent = "AUTHORIZE",
                    purchase_units = new[]
                    {
                        new
                        {
                            amount = new
                            {
                                currency_code = "EUR",
                                value = pretOferta.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture)
                            },
                            description = descriereOferta
                        }
                    }
                };

                var content = new StringContent(JsonSerializer.Serialize(orderRequest), Encoding.UTF8, "application/json");
                var response = await client.PostAsync($"{sandboxUrl}/v2/checkout/orders", content);
                var jsonResponse = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    return BadRequest(new { eroare = "Eroare PayPal la creare", detalii = jsonResponse });
                }

                var result = JsonSerializer.Deserialize<JsonElement>(jsonResponse);
                return Ok(new { id = result.GetProperty("id").GetString() });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = ex.Message });
            }
        }

        [HttpPost("FinalizeazaComanda")]
        public async Task<IActionResult> FinalizeazaComanda([FromBody] FinalizareComanda dto)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            try
            {
                var accessToken = await GetAccessToken();
                using var client = new HttpClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                client.DefaultRequestHeaders.Add("Prefer", "return=representation");
                var content = new StringContent("", Encoding.UTF8, "application/json");
                var response = await client.PostAsync($"{sandboxUrl}/v2/checkout/orders/{dto.OrderID}/authorize", content);
                var jsonResponse = await response.Content.ReadAsStringAsync();
                
                if (!response.IsSuccessStatusCode)
                {
                    return BadRequest(new { mesaj = "Eroare la autorizare", detalii = jsonResponse });
                }
                
                var result = JsonSerializer.Deserialize<JsonElement>(jsonResponse);
                var authId = result.GetProperty("purchase_units")[0].GetProperty("payments").GetProperty("authorizations")[0].GetProperty("id").GetString();
                return Ok(new { authorizationId = authId });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = ex.Message });
            }
        }

        [HttpPost("{idAngajare}/elibereaza-plata")]
        [Authorize]
        public async Task<IActionResult> ElibereazaPlata(int idAngajare)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    string idAutorizare = string.Empty;
                    string sqlVerify = @"
                        SELECT c.id_utilizator, a.id_autorizare_plata
                        FROM ""ANGAJARE"" a
                        JOIN ""ACTIVITATE"" act ON a.id_activitate = act.id_activitate
                        JOIN ""PROIECT"" p ON act.id_proiect = p.id_proiect
                        JOIN ""CLIENT"" c ON p.id_client = c.id_client
                        WHERE a.id_angajare = @idAngajare";

                    using (var cmdVerify = new NpgsqlCommand(sqlVerify, connection))
                    {
                        cmdVerify.Parameters.AddWithValue("@idAngajare", idAngajare);
                        using (var reader = await cmdVerify.ExecuteReaderAsync())
                        {
                            if (!await reader.ReadAsync())
                            {
                                return NotFound(new { eroare = "Angajarea nu a fost găsită." });
                            }
                            if (reader.GetInt32(0) != idUserCurent.Value)
                            {
                                return Forbid();
                            }

                            idAutorizare = reader.IsDBNull(1) ? null : reader.GetString(1);
                        }
                    }

                    if (string.IsNullOrEmpty(idAutorizare))
                    {
                        return BadRequest(new { eroare = "Nu a fost găsită o plată PayPal asociată." });
                    }

                    var accessToken = await GetAccessToken();
                    using var client = new HttpClient();
                    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                    var content = new StringContent("{}", Encoding.UTF8, "application/json");
                    var response = await client.PostAsync($"{sandboxUrl}/v2/payments/authorizations/{idAutorizare}/capture", content);
                    var jsonResponse = await response.Content.ReadAsStringAsync();

                    if (!response.IsSuccessStatusCode)
                    {
                        return BadRequest(new { eroare = "Eroare la capturare PayPal", detalii = jsonResponse });
                    }

                    using (var transaction = await connection.BeginTransactionAsync())
                    {
                        try
                        {
                            string sqlUpdatePlata = @"UPDATE ""PLATA_CONDITIONATA"" SET status = 'Eliberata' WHERE id_autorizare_plata = @idAuth";
                            using (var cmdUpdate = new NpgsqlCommand(sqlUpdatePlata, connection, transaction))
                            {
                                cmdUpdate.Parameters.AddWithValue("@idAuth", idAutorizare);
                                await cmdUpdate.ExecuteNonQueryAsync();
                            }

                            string sqlUpdateAngajare = @"UPDATE ""ANGAJARE"" SET status_plata = 'Finalizat' WHERE id_angajare = @idAngajare";
                            using (var cmdUpdateAngajare = new NpgsqlCommand(sqlUpdateAngajare, connection, transaction))
                            {
                                cmdUpdateAngajare.Parameters.AddWithValue("@idAngajare", idAngajare);
                                await cmdUpdateAngajare.ExecuteNonQueryAsync();
                            }

                            await transaction.CommitAsync();
                        }
                        catch
                        {
                            await transaction.RollbackAsync();
                            throw;
                        }
                    }

                    return Ok(new { mesaj = "Plata a fost capturată și eliberată cu succes." });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = ex.Message });
            }
        }
    } 
} 