using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration;
using FreelancerApp.Server.Models;
using Microsoft.AspNetCore.Authorization;

namespace FreelancerApp.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RecenzieController : ControllerBase
    {
        private readonly string _connectionString = String.Empty;
        
        public RecenzieController(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("LicentaBaza");
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

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> AdaugaRecenzie([FromBody] RecenzieRequest request)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            if (request.Nota < 1 || request.Nota > 5)
            {
                return BadRequest(new { eroare = "Nota trebuie să fie între 1 și 5." });
            }

            if (request.TipAutor != "Freelancer" && request.TipAutor != "Client")
            {
                return BadRequest(new { eroare = "Tip autor invalid." });
            }

            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    string sqlVerificare = @"
                        SELECT f.id_utilizator AS id_user_freelancer, c.id_utilizator AS id_user_client
                        FROM ""ANGAJARE"" a
                        JOIN ""FREELANCER"" f ON a.id_freelancer = f.id_freelancer
                        JOIN ""ACTIVITATE"" act ON a.id_activitate = act.id_activitate
                        JOIN ""PROIECT"" p ON act.id_proiect = p.id_proiect
                        JOIN ""CLIENT"" c ON p.id_client = c.id_client
                        WHERE a.id_angajare = @idAngajare";

                    using (var cmdVerif = new NpgsqlCommand(sqlVerificare, connection))
                    {
                        cmdVerif.Parameters.AddWithValue("@idAngajare", request.IdAngajare);
                        using (var reader = await cmdVerif.ExecuteReaderAsync())
                        {
                            if (!await reader.ReadAsync())
                            {
                                return NotFound(new { eroare = "Angajarea nu a fost găsită." });
                            }

                            int idUserFreelancer = reader.GetInt32(reader.GetOrdinal("id_user_freelancer"));
                            int idUserClient = reader.GetInt32(reader.GetOrdinal("id_user_client"));

                            if (request.TipAutor == "Freelancer" && idUserCurent.Value != idUserFreelancer)
                            {
                                return Forbid(); 
                            }
                            
                            if (request.TipAutor == "Client" && idUserCurent.Value != idUserClient)
                            {
                                return Forbid();
                            }
                        }
                    }

                    string sqlCheck = @"SELECT COUNT(*)
                    FROM ""RECENZIE""
                    WHERE id_angajare = @idAngajare AND tip_autor = @tipAutor";
                    
                    using (var cmd = new NpgsqlCommand(sqlCheck, connection))
                    {
                        cmd.Parameters.AddWithValue("@idAngajare", request.IdAngajare);
                        cmd.Parameters.AddWithValue("@tipAutor", request.TipAutor);
                        long count = (long)await cmd.ExecuteScalarAsync();
                        if (count > 0)
                        {
                            return BadRequest(new { eroare = "Ai lăsat deja o recenzie pentru această angajare." });
                        }
                    }

                    string sqlInsert = @"INSERT INTO ""RECENZIE"" (id_angajare, tip_autor, nota, comentariu, data)
                    VALUES (@idAngajare, @tipAutor, @nota, @comentariu, CURRENT_TIMESTAMP)";
                    
                    using (var cmd = new NpgsqlCommand(sqlInsert, connection))
                    {
                        cmd.Parameters.AddWithValue("@idAngajare", request.IdAngajare);
                        cmd.Parameters.AddWithValue("@tipAutor", request.TipAutor);
                        cmd.Parameters.AddWithValue("@nota", request.Nota);
                        cmd.Parameters.AddWithValue("@comentariu", request.Comentariu ?? (object)DBNull.Value);
                        await cmd.ExecuteNonQueryAsync();
                    }
                }
                return Ok(new { mesaj = "Recenzia a fost adăugată cu succes." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = "Eroare la adăugarea recenziei: " + ex.Message });
            }
        }

        [HttpGet("freelancer/{idFreelancer}")]
        public async Task<IActionResult> GetRecenziiFreelancer(int idFreelancer)
        {
            try
            {
                var recenzii = new List<object>();
                decimal medie = 0;
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string sqlRecenzii = @"SELECT r.id_recenzie, r.nota, r.comentariu, r.data
                    FROM ""RECENZIE"" r
                    JOIN ""ANGAJARE"" a ON r.id_angajare = a.id_angajare
                    JOIN ""FREELANCER"" f ON a.id_freelancer = f.id_freelancer
                    WHERE f.id_freelancer = @idFreelancer
                    AND r.tip_autor = 'Client'
                    ORDER BY r.data DESC";
                    
                    using (var cmd = new NpgsqlCommand(sqlRecenzii, connection))
                    {
                        cmd.Parameters.AddWithValue("@idFreelancer", idFreelancer);
                        using var reader = await cmd.ExecuteReaderAsync();
                        while (await reader.ReadAsync())
                        {
                            recenzii.Add(new
                            {
                                idRecenzie = reader.GetInt32(0),
                                nota = reader.GetInt32(1),
                                comentariu = reader.IsDBNull(2) ? "" : reader.GetString(2),
                                data = reader.GetDateTime(3)
                            });
                        }
                    }
                    if (recenzii.Count > 0)
                    {
                        string sqlMedie = @"SELECT ROUND(AVG(r.nota), 1)
                        FROM ""RECENZIE"" r
                        JOIN ""ANGAJARE"" a ON r.id_angajare = a.id_angajare
                        JOIN ""FREELANCER"" f ON a.id_freelancer = f.id_freelancer
                        WHERE f.id_freelancer = @idFreelancer
                        AND r.tip_autor = 'Client'";
                        
                        using (var cmd = new NpgsqlCommand(sqlMedie, connection))
                        {
                            cmd.Parameters.AddWithValue("@idFreelancer", idFreelancer);
                            var result = await cmd.ExecuteScalarAsync();
                            medie = result != DBNull.Value ? (decimal)result : 0;
                        }
                    }
                }
                return Ok(new { recenzii, medie });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = "Eroare: " + ex.Message });
            }
        }

        [HttpGet("client/{idClient}")]
        public async Task<IActionResult> GetRecenziiClient(int idClient)
        {
            try
            {
                var recenzii = new List<object>();
                decimal medie = 0;
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string sqlRecenzii = @"SELECT r.id_recenzie, r.nota, r.comentariu, r.data
                    FROM ""RECENZIE"" r
                    JOIN ""ANGAJARE"" a ON r.id_angajare = a.id_angajare
                    JOIN ""ACTIVITATE"" act ON a.id_activitate = act.id_activitate
                    JOIN ""PROIECT"" p ON act.id_proiect = p.id_proiect
                    JOIN ""CLIENT"" c ON p.id_client = c.id_client
                    WHERE c.id_client = @idClient
                    AND r.tip_autor = 'Freelancer'
                    ORDER BY r.data DESC";
                    
                    using (var cmd = new NpgsqlCommand(sqlRecenzii, connection))
                    {
                        cmd.Parameters.AddWithValue("@idClient", idClient);
                        using var reader = await cmd.ExecuteReaderAsync();
                        while (await reader.ReadAsync())
                        {
                            recenzii.Add(new
                            {
                                idRecenzie = reader.GetInt32(0),
                                nota = reader.GetInt32(1),
                                comentariu = reader.IsDBNull(2) ? "" : reader.GetString(2),
                                data = reader.GetDateTime(3)
                            });
                        }
                    }
                    if (recenzii.Count > 0)
                    {
                        string sqlMedie = @"SELECT ROUND(AVG(r.nota), 1)
                        FROM ""RECENZIE"" r
                        JOIN ""ANGAJARE"" a ON r.id_angajare = a.id_angajare
                        JOIN ""ACTIVITATE"" act ON a.id_activitate = act.id_activitate
                        JOIN ""PROIECT"" p ON act.id_proiect = p.id_proiect
                        JOIN ""CLIENT"" c ON p.id_client = c.id_client
                        WHERE c.id_client = @idClient
                        AND r.tip_autor = 'Freelancer'";
                        
                        using (var cmd = new NpgsqlCommand(sqlMedie, connection))
                        {
                            cmd.Parameters.AddWithValue("@idClient", idClient);
                            var result = await cmd.ExecuteScalarAsync();
                            medie = result != DBNull.Value ? (decimal)result : 0;
                        }
                    }
                }
                return Ok(new { recenzii, medie });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = "Eroare: " + ex.Message });
            }
        }
    }
}