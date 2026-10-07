using Microsoft.AspNetCore.Mvc;
using FreelancerApp.Server.Models;
using Microsoft.EntityFrameworkCore;
using System.Net;
using Npgsql;
using System.Data;
using BC = BCrypt.Net.BCrypt;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using System.ComponentModel.DataAnnotations;
using FreelancerApp.Server.Services;
using System.Numerics;
namespace FreelancerApp.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UtilizatorController : ControllerBase
    {
        private readonly string _connectionString = string.Empty;
        private readonly IConfiguration _configuration;

        private readonly EmbeddingService _embeddingService;
        public UtilizatorController(IConfiguration configuration, EmbeddingService embeddingService)
        {
            _connectionString = configuration.GetConnectionString("LicentaBaza");
            _configuration = configuration;
            _embeddingService = embeddingService;
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

        private async Task<string> GenereazaVectorEmbedding(string profesie, string nume)
        {
            string textEmbedding = $"{profesie} {nume}";
            float[] embedding = await _embeddingService.GetEmbeddingAsync(textEmbedding);
            return "[" + string.Join(",", embedding.Select(f => f.ToString(System.Globalization.CultureInfo.InvariantCulture))) + "]";
        }

        [HttpPost("inregistrare-client")]
        public async Task<IActionResult> InregistrareClient([FromBody] InregistrareClientRequest cerere)
        {
            return await ExecutaInregistrare(cerere, "CLIENT", "cnp_cui", cerere.CnpCui);
        }

        [HttpPost("inregistrare-freelancer")]
        public async Task<IActionResult> InregistrareFreelancer([FromBody] InregistrareFreelancerRequest cerere)
        {
            var result = await ExecutaInregistrare(cerere, "FREELANCER", "iban", cerere.Iban, "profesie", cerere.Profesie);
            if (result is OkObjectResult)
            {
                try
                {
                    string vectorString = await GenereazaVectorEmbedding(cerere.Profesie, cerere.Nume);
                    using var connection = new NpgsqlConnection(_connectionString);
                    await connection.OpenAsync();
                    string sql = @"UPDATE ""FREELANCER"" SET embedding = @embedding::vector
                    WHERE id_utilizator = (SELECT id_utilizator FROM ""UTILIZATOR"" WHERE email = @email)";
                    using var cmd = new NpgsqlCommand(sql, connection);
                    cmd.Parameters.AddWithValue("@embedding", vectorString);
                    cmd.Parameters.AddWithValue("@email", cerere.Email);
                    await cmd.ExecuteNonQueryAsync();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Eroare la generarea embedding-ului: {ex.Message}");
                }
            }
            return result;
        }

        [HttpPost("Inregistrare-expert")]
        public async Task<IActionResult> InregistrareExpert([FromBody] InregistrareExpertRequest cerere)
        {
            return await ExecutaInregistrare(cerere, "EXPERT_LEGAL", "departament", cerere.Departament, "cod_legitimatie", cerere.CodLegitimatie);
        }

        [HttpPost("Inregistrare-admin")]
        public async Task<IActionResult> InregistrareAdmin([FromBody] InregistrareAdminRequest cerere)
        {
            string checkSqlAdmin = "SELECT COUNT(*) FROM \"ADMIN\" WHERE \"cod_admin\" = @cod";
            using (var connection = new NpgsqlConnection(_connectionString))
            {
                await connection.OpenAsync();
                using (var cmd = new NpgsqlCommand(checkSqlAdmin, connection))
                {
                    cmd.Parameters.AddWithValue("@cod", cerere.codAdmin);
                    var exists = (long)await cmd.ExecuteScalarAsync()!;
                    if (exists == 0)
                    {
                        return BadRequest("Codul de administrator este incorect.");
                    }
                }
                return await ExecutaInregistrare(cerere, "ADMIN", "cod_admin", cerere.codAdmin);
            }
        }

        private async Task<IActionResult> ExecutaInregistrare(
            DateInregistrare user,
            string tabel,
            string col1,
            string val1,
            string? col2 = null,
            string? val2 = null)
        {
            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string checkSql = "SELECT COUNT(*) FROM \"UTILIZATOR\" WHERE \"email\" = @email";
                    using (var checkCmd = new NpgsqlCommand(checkSql, connection))
                    {
                        checkCmd.Parameters.AddWithValue("@email", user.Email);
                        var exists = (long)await checkCmd.ExecuteScalarAsync()!;
                        if (exists > 0)
                        {
                            return BadRequest("Există un cont cu acest email.");
                        }
                    }
                    using (var trans = await connection.BeginTransactionAsync())
                    {
                        int noulId = 0;
                        string insertSql = "INSERT INTO \"UTILIZATOR\" (\"nume\", \"email\", \"parola\", \"telefon\")  VALUES (@nume, @email, @parola, @telefon) RETURNING id_utilizator";
                        using (var insertCmd = new NpgsqlCommand(insertSql, connection, trans))
                        {
                            insertCmd.Parameters.AddWithValue("@nume", user.Nume);
                            insertCmd.Parameters.AddWithValue("@email", user.Email);
                            insertCmd.Parameters.AddWithValue("@parola", BC.HashPassword(user.Parola));
                            insertCmd.Parameters.AddWithValue("@telefon", (object?)user.Telefon ?? DBNull.Value);
                            var idResult = await insertCmd.ExecuteScalarAsync();
                            noulId = Convert.ToInt32(idResult);
                        }
                        string adresaSql = "INSERT INTO \"ADRESA\"(id_utilizator, judet, oras, strada, numar) VALUES (@id_utilizator, @judet, @oras, @strada, @numar)";
                        using (var adresaCmd = new NpgsqlCommand(adresaSql, connection, trans))
                        {
                            adresaCmd.Parameters.AddWithValue("@id_utilizator", noulId);
                            adresaCmd.Parameters.AddWithValue("@judet", user.Judet);
                            adresaCmd.Parameters.AddWithValue("@oras", user.Oras);
                            adresaCmd.Parameters.AddWithValue("@strada", user.Strada);
                            adresaCmd.Parameters.AddWithValue("@numar", user.Numar);
                            await adresaCmd.ExecuteNonQueryAsync();
                        }
                        string sqlTabel = col2 == null
                        ? $"INSERT INTO \"{tabel}\" (\"id_utilizator\", \"{col1}\") VALUES (@id, @v1)"
                        : $"INSERT INTO \"{tabel}\" (\"id_utilizator\", \"{col1}\", \"{col2}\") VALUES (@id, @v1, @v2)";
                        using (var insertCmd = new NpgsqlCommand(sqlTabel, connection, trans))
                        {
                            insertCmd.Parameters.AddWithValue("@id", noulId);
                            insertCmd.Parameters.AddWithValue("@v1", val1);
                            if (col2 != null && val2 != null)
                            {
                                insertCmd.Parameters.AddWithValue("@v2", val2);
                            }
                            await insertCmd.ExecuteNonQueryAsync();
                        }
                        await trans.CommitAsync();
                    }
                }

                return Ok($"Cont de tip {tabel} înregistrat cu succes.");
            }
            catch (PostgresException ex) when (ex.SqlState == "23505")
            {
                string mesaj = "Aceste date există deja în sistem.";
                if (ex.ConstraintName != null)
                {
                    if (ex.ConstraintName.ToLower().Contains("cui"))
                    {
                        mesaj = "Acest CNP sau CUI este deja înregistrat în sistem.";
                    }
                    else if (ex.ConstraintName.ToLower().Contains("iban"))
                    {
                        mesaj = "Acest IBAN este deja înregistrat.";
                    }
                    else if (ex.ConstraintName.ToLower().Contains("email"))
                    {
                        mesaj = "Exista deja un cont cu această adresă de email.";
                    }
                    else if (ex.ConstraintName.ToLower().Contains("telefon"))
                    {
                        mesaj = "Acest număr de telefon este deja folosit.";
                    }
                    else if (ex.ConstraintName.ToLower().Contains("CodLegitimatie"))
                    {
                        mesaj = "Acest cod de legitimație este deja folosit.";
                    }
                }
                return BadRequest(mesaj);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Eroare internă la baza de date: " + ex.Message);
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest cerere)
        {
            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    int idUser = 0;
                    string numeUser = "";
                    string parolaDb = "";
                    string email = "";
                    string sqlUser = @"SELECT u.id_utilizator, u.nume, u.parola, u.email 
                    FROM ""UTILIZATOR"" u
                    LEFT JOIN ""CLIENT"" c ON u.id_utilizator = c.id_utilizator
                    LEFT JOIN ""EXPERT_LEGAL"" e ON u.id_utilizator = e.id_utilizator
                    LEFT JOIN ""ADMIN"" a ON u.id_utilizator = a.id_utilizator
                    WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(@id))
                        OR LOWER(TRIM(u.nume)) = LOWER(TRIM(@id))
                        OR LOWER(TRIM(c.cnp_cui)) = LOWER(TRIM(@id))
                        OR LOWER(TRIM(e.cod_legitimatie)) = LOWER(TRIM(@id))
                        OR LOWER(TRIM(a.cod_admin)) = LOWER(TRIM(@id))";
                    using (var cmd = new NpgsqlCommand(sqlUser, connection))
                    {
                        cmd.Parameters.AddWithValue("@id", cerere.Identificator);
                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            if (await reader.ReadAsync())
                            {
                                idUser = reader.GetInt32(0);
                                numeUser = reader.GetString(1);
                                parolaDb = reader.GetString(2);
                                email = reader.GetString(3);
                            }
                            else
                            {
                                return Unauthorized("Numele, email-ul și/sau parola nu există");
                            }
                        }
                    }
                    if (!BC.Verify(cerere.Parola, parolaDb))
                    {
                        return Unauthorized("Email sau parolă incorectă.");
                    }
                    if (string.IsNullOrEmpty(cerere.Rol))
                    {
                        return BadRequest("Te rog selectează un tip de cont pentru a te autentifica.");
                    }
                    string tabelCautat = "";
                    if (cerere.Rol == "Client")
                    {
                        tabelCautat = "\"CLIENT\"";
                    }
                    else if (cerere.Rol == "Freelancer")
                    {
                        tabelCautat = "\"FREELANCER\"";
                    }
                    else if (cerere.Rol == "Expert_Legal")
                    {
                        tabelCautat = "\"EXPERT_LEGAL\"";
                    }
                    else if (cerere.Rol == "Admin")
                    {
                        tabelCautat = "\"ADMIN\"";
                    }
                    else
                    {
                        return BadRequest($"Rol selectat invalid '{cerere.Rol}'");
                    }
                    string sqlVerificareRol = $"SELECT COUNT(*) FROM {tabelCautat} WHERE id_utilizator = @id";
                    using (var cmdRol = new NpgsqlCommand(sqlVerificareRol, connection))
                    {
                        cmdRol.Parameters.AddWithValue("@id", idUser);
                        var areRolul = (long)await cmdRol.ExecuteScalarAsync();
                        if (areRolul == 0)
                        {
                            return Unauthorized($"Acest cont există, dar nu are profil creat pentru rolul de {cerere.Rol}.");
                        }
                    }
                    string rolActiv = cerere.Rol;
                    int? idSpecificClient = null;
                    if (rolActiv == "Client")
                    {
                        string sqlClient = "SELECT id_client FROM \"CLIENT\" WHERE id_utilizator = @id";
                        using (var cmdClient = new NpgsqlCommand(sqlClient, connection))
                        {
                            cmdClient.Parameters.AddWithValue("@id", idUser);
                            var clientResult = await cmdClient.ExecuteScalarAsync();
                            if (clientResult != null)
                            {
                                idSpecificClient = Convert.ToInt32(clientResult);
                            }
                        }
                    }
                    var cheie = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Cheie"]!));
                    var credentiale = new SigningCredentials(cheie, SecurityAlgorithms.HmacSha256);
                    var claims = new[]
                    {
                        new Claim("id", idUser.ToString()),
                        new Claim("rol", rolActiv),
                        new Claim("nume", numeUser)
                    };
                    var token = new JwtSecurityToken(
                        claims: claims,
                        expires: DateTime.Now.AddHours(8),
                        signingCredentials: credentiale
                    );
                    string tokenString = new JwtSecurityTokenHandler().WriteToken(token);
                    return Ok(new
                    {
                        token = tokenString,
                        mesaj = "Autentificare cu succes.",
                        id = idUser,
                        idClient = idSpecificClient,
                        nume = numeUser,
                        rol = rolActiv
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Eroare la login " + ex.Message);
            }
        }

        [HttpGet("profil/{id}")]
        [Authorize]
        public async Task<IActionResult> PreluareProfil(int id)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }
            if (idUserCurent.Value != id && GetRolCurent() != "Admin")
            {
                return Forbid();
            }
            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string sql = @"SELECT u.nume, u.email , u.telefon, ad.judet, ad.oras, ad.strada, ad.numar, c.cnp_cui, f.iban, f.profesie, e.departament, e.cod_legitimatie
                                FROM ""UTILIZATOR"" u  LEFT JOIN ""ADRESA"" ad ON u.id_utilizator = ad.id_utilizator
                                LEFT JOIN ""CLIENT"" c ON u.id_utilizator = c.id_utilizator
                                LEFT JOIN ""FREELANCER"" f ON u.id_utilizator = f.id_utilizator
                                LEFT JOIN ""EXPERT_LEGAL"" e ON u.id_utilizator = e.id_utilizator
                                WHERE u.id_utilizator = @id";
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@id", id);
                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            if (await reader.ReadAsync())
                            {
                                return Ok(new
                                {
                                    nume = reader.IsDBNull(0) ? "" : reader.GetString(0),
                                    email = reader.IsDBNull(1) ? "" : reader.GetString(1),
                                    telefon = reader.IsDBNull(2) ? "" : reader.GetString(2),
                                    judet = reader.IsDBNull(3) ? "" : reader.GetString(3),
                                    oras = reader.IsDBNull(4) ? "" : reader.GetString(4),
                                    strada = reader.IsDBNull(5) ? "" : reader.GetString(5),
                                    numar = reader.IsDBNull(6) ? "" : reader.GetString(6),
                                    cnpCui = reader.IsDBNull(7) ? "" : reader.GetString(7),
                                    iban = reader.IsDBNull(8) ? "" : reader.GetString(8),
                                    profesie = reader.IsDBNull(9) ? "" : reader.GetString(9),
                                    departament = reader.IsDBNull(10) ? "" : reader.GetString(10),
                                    CodLegitimatie = reader.IsDBNull(11) ? "" : reader.GetString(11)
                                });
                            }
                            else
                            {
                                return NotFound("Utilizatorul nu a fost găsit.");
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Eroare la preluarea profilului: " + ex.Message);
            }
        }

        [HttpPut("actualizare-date")]
        [Authorize]
        public async Task<IActionResult> ActualizareDate([FromBody] ActualizareDateRequest cerere)
        {
            var idUserClaim = User.FindFirst("id")?.Value;
            if (idUserClaim == null)
            {
                return Unauthorized();
            }
            int idUser = int.Parse(idUserClaim);
            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string checkEmailSql = "SELECT COUNT(*) FROM \"UTILIZATOR\" WHERE email = @email AND id_utilizator != @id";
                    using (var checkCmd = new NpgsqlCommand(checkEmailSql, connection))
                    {
                        checkCmd.Parameters.AddWithValue("@email", cerere.Email);
                        checkCmd.Parameters.AddWithValue("@id", idUser);
                        var exists = (long)await checkCmd.ExecuteScalarAsync()!;
                        if (exists > 0)
                        {
                            return BadRequest("Acest email este deja folosit de alt cont.");
                        }
                    }
                    using (var trans = await connection.BeginTransactionAsync())
                    {
                        string updateUtilizator = "UPDATE \"UTILIZATOR\" SET nume = @nume, email = @email, telefon = @telefon";
                        if (!string.IsNullOrEmpty(cerere.Parola))
                        {
                            updateUtilizator += ", parola = @parola";
                        }
                        updateUtilizator += " WHERE id_utilizator = @id";
                        using (var cmdU = new NpgsqlCommand(updateUtilizator, connection, trans))
                        {
                            cmdU.Parameters.AddWithValue("@nume", cerere.Nume);
                            cmdU.Parameters.AddWithValue("@email", cerere.Email);
                            cmdU.Parameters.AddWithValue("@telefon", (object?)cerere.Telefon ?? DBNull.Value);
                            cmdU.Parameters.AddWithValue("@id", idUser);
                            if (!string.IsNullOrEmpty(cerere.Parola))
                            {
                                cmdU.Parameters.AddWithValue("@parola", BC.HashPassword(cerere.Parola));
                            }
                            await cmdU.ExecuteNonQueryAsync();
                        }
                        string updateAdresa = "UPDATE \"ADRESA\" SET judet = @judet, oras = @oras, strada = @strada , numar = @numar WHERE id_utilizator = @id";
                        using (var cmdA = new NpgsqlCommand(updateAdresa, connection, trans))
                        {
                            cmdA.Parameters.AddWithValue("@judet", cerere.Judet);
                            cmdA.Parameters.AddWithValue("@oras", cerere.Oras);
                            cmdA.Parameters.AddWithValue("@strada", cerere.Strada);
                            cmdA.Parameters.AddWithValue("@numar", cerere.Numar);
                            cmdA.Parameters.AddWithValue("@id", idUser);
                            await cmdA.ExecuteNonQueryAsync();
                        }
                        if (!string.IsNullOrEmpty(cerere.CnpCui))
                        {
                            string updateC = "UPDATE \"CLIENT\" SET cnp_cui = @cnp WHERE id_utilizator = @id";
                            using (var cmdC = new NpgsqlCommand(updateC, connection, trans))
                            {
                                cmdC.Parameters.AddWithValue("@cnp", cerere.CnpCui);
                                cmdC.Parameters.AddWithValue("@id", idUser);
                                await cmdC.ExecuteNonQueryAsync();
                            }
                        }
                        if (!string.IsNullOrEmpty(cerere.Iban))
                        {
                            string vectorString = await GenereazaVectorEmbedding(cerere.Profesie, cerere.Nume);
                            string updateF = "UPDATE \"FREELANCER\" SET iban = @iban, profesie = @profesie, embedding = @embedding::vector WHERE id_utilizator = @id";
                            using (var cmdF = new NpgsqlCommand(updateF, connection, trans))
                            {
                                cmdF.Parameters.AddWithValue("@iban", cerere.Iban);
                                cmdF.Parameters.AddWithValue("@profesie", cerere.Profesie);
                                cmdF.Parameters.AddWithValue("@embedding", vectorString);
                                cmdF.Parameters.AddWithValue("@id", idUser);
                                await cmdF.ExecuteNonQueryAsync();
                            }
                        }
                        if (!string.IsNullOrEmpty(cerere.CodLegitimatie))
                        {
                            string updateE = "UPDATE \"EXPERT_LEGAL\" SET departament = @dep, cod_legitimatie = @cod WHERE id_utilizator = @id";
                            using (var cmdE = new NpgsqlCommand(updateE, connection, trans))
                            {
                                cmdE.Parameters.AddWithValue("@dep", cerere.Departament);
                                cmdE.Parameters.AddWithValue("@cod", cerere.CodLegitimatie);
                                cmdE.Parameters.AddWithValue("@id", idUser);
                                await cmdE.ExecuteNonQueryAsync();
                            }
                        }
                        await trans.CommitAsync();
                    }
                    return Ok("Datele au fost actualizate cu succes.");
                }
            }
            catch (PostgresException ex) when (ex.SqlState == "23505")
            {
                return BadRequest("Aceste date unice există deja la alt utilizator.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Eroare internă la baza de date " + ex.Message);
            }
        }

        [HttpPost("schimbare-rol")]
        [Authorize]
        public async Task<IActionResult> SchimbareRol([FromBody] SchimbareRolRequest cerere)
        {
            var idUserClaim = User.FindFirst("id")?.Value;
            if (idUserClaim == null)
            {
                return Unauthorized();
            }
            int idUser = int.Parse(idUserClaim);
            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string sqlCheck = "";
                    string sqlInsert = "";
                    if (cerere.RolNou == "Client")
                    {
                        sqlCheck = "SELECT COUNT(*) FROM \"CLIENT\" WHERE id_utilizator = @id";
                        sqlInsert = "INSERT INTO \"CLIENT\" (id_utilizator, cnp_cui) VALUES (@id, @v1)";
                    }
                    else if (cerere.RolNou == "Freelancer")
                    {
                        sqlCheck = "SELECT COUNT(*) FROM \"FREELANCER\" WHERE id_utilizator = @id";
                        sqlInsert = "INSERT INTO \"FREELANCER\"(id_utilizator, iban, profesie, embedding) VALUES (@id, @v1, @v2, @embedding::vector)";
                    }
                    else if (cerere.RolNou == "ExpertLegal")
                    {
                        sqlCheck = "SELECT COUNT(*) FROM \"EXPERT_LEGAL\" WHERE id_utilizator = @id";
                        sqlInsert = "INSERT INTO \"EXPERT_LEGAL\" (id_utilizator, departament, cod_legitimatie) VALUES (@id, @v1, @v2)";
                    }
                    else if (cerere.RolNou == "Admin")
                    {
                        string checkAdmin = "SELECT COUNT(*) FROM \"ADMIN\" WHERE \"cod_admin\" = @codAdmin";
                        using (var cmdA = new NpgsqlCommand(checkAdmin, connection))
                        {
                            cmdA.Parameters.AddWithValue("@codAdmin", cerere.CodAdmin ?? "");
                            var existsA = (long)await cmdA.ExecuteScalarAsync()!;
                            if (existsA == 0)
                            {
                                return BadRequest("Codul de administrator este incorect");
                            }
                        }
                        sqlCheck = "SELECT COUNT(*) FROM \"ADMIN\" WHERE id_utilizator = @id";
                        sqlInsert = "INSERT INTO \"ADMIN\"(id_utilizator, cod_admin) VALUES (@id, @v1)";
                    }
                    else
                    {
                        return BadRequest("Rol necunoscut.");
                    }
                    using (var cmdCheck = new NpgsqlCommand(sqlCheck, connection))
                    {
                        cmdCheck.Parameters.AddWithValue("@id", idUser);
                        var count = (long)await cmdCheck.ExecuteScalarAsync();
                        if (count > 0)
                        {
                            return BadRequest($"Ai deja profil creat pentru rolul de {cerere.RolNou}!");
                        }

                        string? vectorString = null;
                        if (cerere.RolNou == "Freelancer")
                        {
                            string numeUtilizator = "";
                            string sqlNume = "SELECT nume FROM \"UTILIZATOR\" WHERE id_utilizator = @id";
                            using (var cmdNume = new NpgsqlCommand(sqlNume, connection))
                            {
                                cmdNume.Parameters.AddWithValue("@id", idUser);
                                var numeResult = await cmdNume.ExecuteScalarAsync();
                                numeUtilizator = numeResult?.ToString() ?? "";
                            }
                            vectorString = await GenereazaVectorEmbedding(cerere.Profesie ?? "", numeUtilizator);
                        }

                        using (var cmdIn = new NpgsqlCommand(sqlInsert, connection))
                        {
                            cmdIn.Parameters.AddWithValue("@id", idUser);
                            if (cerere.RolNou == "Client")
                            {
                                cmdIn.Parameters.AddWithValue("@v1", cerere.CnpCui ?? (object)DBNull.Value);
                            }
                            if (cerere.RolNou == "Freelancer")
                            {
                                cmdIn.Parameters.AddWithValue("@v1", cerere.Iban ?? (object)DBNull.Value);
                                cmdIn.Parameters.AddWithValue("@v2", cerere.Profesie ?? (object)DBNull.Value);
                                cmdIn.Parameters.AddWithValue("@embedding", vectorString!);
                            }
                            if (cerere.RolNou == "Admin")
                            {
                                cmdIn.Parameters.AddWithValue("@v1", cerere.CodAdmin ?? (object)DBNull.Value);
                            }
                            if (cerere.RolNou == "ExpertLegal")
                            {
                                cmdIn.Parameters.AddWithValue("@v1", cerere.Departament ?? (object)DBNull.Value);
                                cmdIn.Parameters.AddWithValue("@v2", cerere.CodLegitimatie ?? (object)DBNull.Value);
                            }
                            await cmdIn.ExecuteNonQueryAsync();
                        }
                        return Ok($"Rol schimbat cu succes în {cerere.RolNou}.");
                    }
                }
            }
            catch (PostgresException ex) when (ex.SqlState == "23505")
            {
                return BadRequest("Aceste date unice (CNP/IBan) aparțin altui utilizator.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Eroare internă la baza de date: " + ex.Message);
            }
        }

        [HttpGet("Toti")]
        [Authorize]
        public async Task<IActionResult> GetTotiUtilizatorii()
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }
            if (GetRolCurent() != "Admin")
            {
                return Forbid();
            }
            try
            {
                var listaUtilizatori = new List<object>();
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string sql = @"SELECT u.id_utilizator, u.nume, u.email, u.telefon, CONCAT_WS(', ', CASE WHEN c.id_utilizator IS NOT NULL THEN 'Client' ELSE NULL END,
                    CASE WHEN f.id_utilizator IS NOT NULL THEN 'Freelancer' ELSE NULL END,
                    CASE WHEN e.id_utilizator IS NOT NULL THEN 'Expert Legal' ELSE NULL END,
                    CASE WHEN a.id_utilizator IS NOT NULL THEN 'Admin' ELSE NULL END) as roluri
                    FROM ""UTILIZATOR"" u
                    LEFT JOIN ""CLIENT"" c ON u.id_utilizator = c.id_utilizator
                    LEFT JOIN ""FREELANCER"" f ON u.id_utilizator = f.id_utilizator
                    LEFT JOIN ""EXPERT_LEGAL"" e ON u.id_utilizator = e.id_utilizator
                    LEFT JOIN ""ADMIN"" a ON u.id_utilizator = a.id_utilizator
                    ORDER BY u.id_utilizator ASC";
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            listaUtilizatori.Add(new
                            {
                                idUser = reader.GetInt32(0),
                                nume = reader.GetString(1),
                                email = reader.GetString(2),
                                telefon = reader.IsDBNull(3) ? "" : reader.GetString(3),
                                roluri = reader.IsDBNull(4) ? "Fără rol" : reader.GetString(4)
                            });
                        }
                    }
                }
                return Ok(listaUtilizatori);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Eroare la aducerea utilizatorilor: " + ex.Message);
            }
        }

        [HttpDelete("sterge/{id}")]
        [Authorize]
        public async Task<IActionResult> StergeUtilizator(int id)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }
            if (GetRolCurent() != "Admin")
            {
                return Forbid();
            }
            if (idUserCurent.Value == id)
            {
                return BadRequest("Nu îți poți șterge propriul cont de administrator.");
            }
            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string checkAdmin = "SELECT COUNT(*) FROM \"ADMIN\" WHERE id_utilizator = @id";
                    using (var cmdCheck = new NpgsqlCommand(checkAdmin, connection))
                    {
                        cmdCheck.Parameters.AddWithValue("@id", id);
                        long existaAdmin = (long)await cmdCheck.ExecuteScalarAsync();
                        if (existaAdmin > 0)
                        {
                            return BadRequest("Conturile de admin nu pot fi șterse.");
                        }
                    }
                    string sql = "DELETE FROM \"UTILIZATOR\" WHERE id_utilizator = @id";
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@id", id);
                        int randuriAfectate = await cmd.ExecuteNonQueryAsync();
                        if (randuriAfectate == 0)
                        {
                            return NotFound("Utilizatorul nu a fost găsit");
                        }
                    }
                }

                return Ok("Utilizatorul a fost șters.");
            }
            catch (PostgresException ex) when (ex.SqlState == "23503")
            {
                return BadRequest("Utilizatorul nu poate fi șters deoarece are date active în sistem (proiecte, angajări, dispute). Ștergeți mai întâi rolurile asociate.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Eroare la ștergerea utilizatorului:" + ex.Message);
            }
        }

        [HttpDelete("sterge-rol/{idUtilizator}/{rol}")]
        [Authorize]
        public async Task<IActionResult> StergeRol(int idUtilizator, string rol)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }
            if (GetRolCurent() != "Admin")
            {
                return Forbid();
            }
            if (idUserCurent.Value == idUtilizator)
            {
                return BadRequest("Nu îți poți șterge propriile roluri.");
            }
            var tabele = new Dictionary<string, string>
            {
                {"Client", "CLIENT"},
                {"Freelancer", "FREELANCER"},
                {"Expert Legal", "EXPERT_LEGAL"}
            };
            if (!tabele.ContainsKey(rol))
            {
                return BadRequest("Rol invalid sau rolul de admin nu poate fi șters.");
            }
            string tabel = tabele[rol];
            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            if (rol == "Expert Legal")
            {
                string checkDispute = @"SELECT COUNT(*) FROM ""DISPUTA"" d
                JOIN ""EXPERT_LEGAL"" e ON d.id_expert = e.id_expert
                WHERE e.id_utilizator = @id";
                using (var cmdCheck = new NpgsqlCommand(checkDispute, connection))
                {
                    cmdCheck.Parameters.AddWithValue("@id", idUtilizator);
                    long areDispute = (long)await cmdCheck.ExecuteScalarAsync();
                    if (areDispute > 0)
                    {
                        return BadRequest("Rolul de Expert legal nu poate fi șters deoarece expertul a soluționat dispute în sistem.");
                    }
                }
                string checkValidari = @"SELECT COUNT(*) FROM ""VALIDARE"" v
            JOIN ""EXPERT_LEGAL"" e ON v.id_expert = e.id_expert
            WHERE e.id_utilizator = @id";
                using (var cmdVal = new NpgsqlCommand(checkValidari, connection))
                {
                    cmdVal.Parameters.AddWithValue("@id", idUtilizator);
                    long areValidari = (long)await cmdVal.ExecuteScalarAsync();
                    if (areValidari > 0)
                    {
                        return BadRequest("Rolul de Expert legal nu poate fi șters deoarece expertul a validat certificate în sistem.");
                    }
                }
            }
            string sql = $"DELETE FROM \"{tabel}\" WHERE id_utilizator = @id";
            using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("@id", idUtilizator);
            int randuri = await cmd.ExecuteNonQueryAsync();
            if (randuri == 0)
            {
                return NotFound("Utilizatorul nu are acest rol.");
            }
            return Ok($"Rolul {rol} a fost șters.");
        }
    }
}