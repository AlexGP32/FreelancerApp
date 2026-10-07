using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using FreelancerApp.Server.Models;
using Microsoft.AspNetCore.Authorization;

namespace FreelancerApp.Server.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class CertificatController : ControllerBase
    {
        private readonly string _connectionString = string.Empty;
        private readonly IWebHostEnvironment _env;

        public CertificatController(IConfiguration configuration, IWebHostEnvironment env)
        {
            _connectionString = configuration.GetConnectionString("LicentaBaza");
            _env = env;
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

        private string? GetRolCurent()
        {
            return User.FindFirst("rol")?.Value;
        }

        [HttpPost("adauga")]
        public async Task<IActionResult> AdaugaCertificat([FromForm] AdaugaCertificatRequest cerere)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            try
            {
                if (cerere.Fisier == null || cerere.Fisier.Length == 0)
                {
                    return BadRequest(new { eroare = "Nu a fost încărcat niciun fișier valid." });
                }

                string uploadsFolder = Path.Combine(_env.ContentRootPath, "Uploads");
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                }

                string extensie = Path.GetExtension(cerere.Fisier.FileName);
                string numeFisierUnic = Guid.NewGuid().ToString() + extensie;
                string caleFisierCompleta = Path.Combine(uploadsFolder, numeFisierUnic);

                using (var stream = new FileStream(caleFisierCompleta, FileMode.Create))
                {
                    await cerere.Fisier.CopyToAsync(stream);
                }

                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    string sql = @"INSERT INTO ""CERTIFICAT"" (id_freelancer, tip, fisier, data_incarcarii) VALUES ((SELECT id_freelancer FROM ""FREELANCER"" WHERE id_utilizator = @idUser), @tip, @fisier, @dataIncarcarii)";
                    using (var command = new NpgsqlCommand(sql, connection))
                    {
                        command.Parameters.AddWithValue("@idUser", idUserCurent.Value);
                        command.Parameters.AddWithValue("@tip", cerere.Tip);
                        command.Parameters.AddWithValue("@fisier", numeFisierUnic);
                        command.Parameters.AddWithValue("@dataIncarcarii", DateTime.Now);

                        await command.ExecuteNonQueryAsync();
                    }
                }

                return Ok(new { mesaj = "Certificatul a fost încărcat și trimis spre validare cu succes." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { eroare = $"Eroare la salvare: {ex.Message}" });
            }
        }

        [HttpGet("nevalidate")]
        public async Task<IActionResult> GetCertificateNevalidate()
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            if (GetRolCurent() != "Expert_Legal")
            {
                return Forbid();
            }

            try
            {
                var certificate = new List<object>();

                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    string sql = @"SELECT c.id_certificat, c.id_freelancer, c.fisier, c.tip, c.data_incarcarii
                                   FROM ""CERTIFICAT"" c
                                   LEFT JOIN ""VALIDARE"" v ON c.id_certificat = v.id_certificat
                                   WHERE v.id_certificat IS NULL";

                    using (var cmd = new NpgsqlCommand(sql, connection))
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            certificate.Add(new
                            {
                                idCertificat = reader.GetInt32(0),
                                idFreelancer = reader.GetInt32(1),
                                fisier = reader.IsDBNull(2) ? "" : reader.GetString(2),
                                tip = reader.IsDBNull(3) ? "" : reader.GetString(3),
                                dataIncarcarii = reader.GetDateTime(4)
                            });
                        }
                    }
                }

                return Ok(certificate);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Eroare la aducerea certificatelor " + ex.Message);
            }
        }

        [HttpPost("decizie")]
        public async Task<IActionResult> SalveazaDecizie([FromBody] DecizieRequest cerere)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            if (GetRolCurent() != "Expert_Legal")
            {
                return Forbid();
            }

            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    string sqlExpert = @"SELECT id_expert FROM ""EXPERT_LEGAL"" WHERE id_utilizator = @idUser";
                    int idExpert = 0;

                    using (var cmdExp = new NpgsqlCommand(sqlExpert, connection))
                    {
                        cmdExp.Parameters.AddWithValue("@idUser", idUserCurent.Value);
                        var result = await cmdExp.ExecuteScalarAsync();
                        if (result == null)
                        {
                            return BadRequest("Expertul nu a fost găsit în baza de date");
                        }

                        idExpert = Convert.ToInt32(result);
                    }

                    string sqlProprietarCertificat = @"
                        SELECT f.id_utilizator 
                        FROM ""CERTIFICAT"" c
                        INNER JOIN ""FREELANCER"" f ON c.id_freelancer = f.id_freelancer
                        WHERE c.id_certificat = @idCert";

                    using (var cmdProp = new NpgsqlCommand(sqlProprietarCertificat, connection))
                    {
                        cmdProp.Parameters.AddWithValue("@idCert", cerere.IdCertificat);
                        var idUtilizatorProprietar = await cmdProp.ExecuteScalarAsync();
                        if (idUtilizatorProprietar == null)
                        {
                            return NotFound("Certificatul nu a fost găsit.");
                        }

                        if (Convert.ToInt32(idUtilizatorProprietar) == idUserCurent.Value)
                        {
                            return BadRequest("Nu poți valida propriul certificat.");
                        }
                    }

                    string valoareDecizie = cerere.Aprobat ? "Aprobat" : "Respins";
                    string sqlInsert = @"INSERT INTO ""VALIDARE""(id_certificat, id_expert, decizie, data_validarii, observatii) VALUES (@idCert, @idExp, @decizie, @dataVal, @observatii)";

                    using (var cmdInsert = new NpgsqlCommand(sqlInsert, connection))
                    {
                        cmdInsert.Parameters.AddWithValue("@idCert", cerere.IdCertificat);
                        cmdInsert.Parameters.AddWithValue("@idExp", idExpert);
                        cmdInsert.Parameters.AddWithValue("@decizie", valoareDecizie);
                        cmdInsert.Parameters.AddWithValue("@dataVal", DateTime.Now);

                        if (string.IsNullOrEmpty(cerere.Observatii))
                        {
                            cmdInsert.Parameters.AddWithValue("@observatii", DBNull.Value);
                        }
                        else
                        {
                            cmdInsert.Parameters.AddWithValue("@observatii", cerere.Observatii);
                        }

                        await cmdInsert.ExecuteNonQueryAsync();
                    }
                }

                return Ok(new { mesaj = "Decizia a fost salvată cu succes." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Eroare la salvarea deciziei: " + ex.Message + " | " + ex.InnerException?.Message);
            }
        }

        [HttpGet("status")]
        public async Task<IActionResult> VerificaStatusCertificat()
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

                    string sql = @"
                        SELECT c.id_certificat, v.decizie, v.observatii
                        FROM ""CERTIFICAT"" c
                        LEFT JOIN ""VALIDARE"" v ON c.id_certificat = v.id_certificat
                        WHERE c.id_freelancer = (SELECT id_freelancer FROM ""FREELANCER"" WHERE id_utilizator = @idUser LIMIT 1)";

                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@idUser", idUserCurent.Value);

                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            if (await reader.ReadAsync())
                            {
                                string decizie = reader.IsDBNull(1) ? "" : reader.GetString(1);
                                bool esteValidat = decizie.ToLower() == "aprobat" || decizie.ToLower() == "validat";

                                return Ok(new
                                {
                                    exista = true,
                                    esteValidat,
                                    idCertificat = reader.GetInt32(0),
                                    decizie,
                                    observatii = reader.IsDBNull(2) ? "" : reader.GetString(2)
                                });
                            }
                            else
                            {
                                return NotFound(new { mesaj = "Nu există certificat." });
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = "Eroare: " + ex.Message });
            }
        }

        [HttpPut("editeaza")]
        public async Task<IActionResult> EditeazaCertificat([FromForm] AdaugaCertificatRequest cerere)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            try
            {
                if (cerere.Fisier == null || cerere.Fisier.Length == 0)
                {
                    return BadRequest(new { eroare = "Nu a fost încărcat nici un fișier valid. " });
                }

                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    string sqlFind = @"
                        SELECT c.id_certificat, c.fisier
                        FROM ""CERTIFICAT"" c
                        INNER JOIN ""FREELANCER"" f ON c.id_freelancer = f.id_freelancer
                        WHERE f.id_utilizator = @idUser LIMIT 1";

                    int idCertificat = 0;
                    string fisierVechi = "";

                    using (var cmdFind = new NpgsqlCommand(sqlFind, connection))
                    {
                        cmdFind.Parameters.AddWithValue("@idUser", idUserCurent.Value);

                        using (var reader = await cmdFind.ExecuteReaderAsync())
                        {
                            if (await reader.ReadAsync())
                            {
                                idCertificat = reader.GetInt32(0);
                                fisierVechi = reader.GetString(1);
                            }
                            else
                            {
                                return NotFound(new { eroare = "Nu s-a găsit niciun certificat pentru a fi editat." });
                            }
                        }
                    }

                    string uploadsFolder = Path.Combine(_env.ContentRootPath, "Uploads");
                    if (!string.IsNullOrEmpty(fisierVechi))
                    {
                        string caleVeche = Path.Combine(uploadsFolder, fisierVechi);
                        if (System.IO.File.Exists(caleVeche))
                        {
                            System.IO.File.Delete(caleVeche);
                        }
                    }

                    if (!Directory.Exists(uploadsFolder))
                    {
                        Directory.CreateDirectory(uploadsFolder);
                    }

                    string extensie = Path.GetExtension(cerere.Fisier.FileName);
                    string numeFisierUnic = Guid.NewGuid().ToString() + extensie;
                    string caleFisierCompleta = Path.Combine(uploadsFolder, numeFisierUnic);

                    using (var stream = new FileStream(caleFisierCompleta, FileMode.Create))
                    {
                        await cerere.Fisier.CopyToAsync(stream);
                    }

                    string sqlUpdate = @"
                        UPDATE ""CERTIFICAT"" 
                        SET tip = @tip, fisier = @fisier, data_incarcarii = @dataIncarcarii
                        WHERE id_certificat = @idCertificat;
                        DELETE FROM ""VALIDARE"" WHERE id_certificat = @idCertificat;";

                    using (var cmdUpdate = new NpgsqlCommand(sqlUpdate, connection))
                    {
                        cmdUpdate.Parameters.AddWithValue("@tip", cerere.Tip);
                        cmdUpdate.Parameters.AddWithValue("@fisier", numeFisierUnic);
                        cmdUpdate.Parameters.AddWithValue("@dataIncarcarii", DateTime.Now);
                        cmdUpdate.Parameters.AddWithValue("@idCertificat", idCertificat);

                        await cmdUpdate.ExecuteNonQueryAsync();
                    }
                }

                return Ok(new { mesaj = "Certificatul a fost actualizat cu succes și trimis spre revalidare." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = "Eroare la editare: " + ex.Message });
            }
        }

        [HttpDelete("{idCertificat}")]
        public async Task<IActionResult> StergeCertificat(int idCertificat)
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

                    string sqlFind = @"
                        SELECT c.fisier, f.id_utilizator
                        FROM ""CERTIFICAT"" c
                        INNER JOIN ""FREELANCER"" f ON c.id_freelancer = f.id_freelancer
                        WHERE c.id_certificat = @id";

                    string? fisier = null;

                    using (var cmdFind = new NpgsqlCommand(sqlFind, connection))
                    {
                        cmdFind.Parameters.AddWithValue("@id", idCertificat);

                        using (var reader = await cmdFind.ExecuteReaderAsync())
                        {
                            if (!await reader.ReadAsync())
                            {
                                return NotFound(new { mesaj = "Certificatul nu a fost găsit în baza de date." });
                            }

                            fisier = reader.IsDBNull(0) ? null : reader.GetString(0);
                            int idUtilizatorProprietar = reader.GetInt32(1);
                            if (idUtilizatorProprietar != idUserCurent.Value)
                            {
                                return Forbid();
                            }
                        }
                    }

                    if (!string.IsNullOrEmpty(fisier))
                    {
                        string uploadsFolder = Path.Combine(_env.ContentRootPath, "Uploads");
                        string caleFisier = Path.Combine(uploadsFolder, fisier);
                        if (System.IO.File.Exists(caleFisier))
                        {
                            System.IO.File.Delete(caleFisier);
                        }
                    }

                    string sqlDelete = @"
                        DELETE FROM ""VALIDARE"" WHERE id_certificat = @id;
                        DELETE FROM ""CERTIFICAT"" WHERE id_certificat = @id;";

                    using (var cmdDelete = new NpgsqlCommand(sqlDelete, connection))
                    {
                        cmdDelete.Parameters.AddWithValue("@id", idCertificat);
                        await cmdDelete.ExecuteNonQueryAsync();
                    }
                }

                return Ok(new { mesaj = "Certificatul a fost șters cu succes." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = "Eroare la editare: " + ex.Message });
            }
        }
    }
}