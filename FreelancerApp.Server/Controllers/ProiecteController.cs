using Microsoft.AspNetCore.Mvc;
using FreelancerApp.Server.Models;
using Npgsql;
using System.Text.Json.Serialization;
using System.Numerics;
using FreelancerApp.Server.Services;
using NpgsqlTypes;
using System.Linq;
using System.Net;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.IO;

namespace FreelancerApp.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProiecteController : ControllerBase
    {
        private readonly string _connectionString = string.Empty;
        private readonly EmbeddingService _embeddingService;
        private readonly IWebHostEnvironment _env;

        public ProiecteController(IConfiguration configuration, EmbeddingService embeddingService, IWebHostEnvironment env)
        {
            _connectionString = configuration.GetConnectionString("LicentaBaza");
            _embeddingService = embeddingService;
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

        [HttpPost("adauga")]
        [Authorize]
        public async Task<IActionResult> AdaugaProiect([FromBody] AdaugaProiectRequest cerere)
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

                    int idClientFinal = 0;
                    string sqlVerifClient = @"SELECT id_client FROM ""CLIENT"" WHERE id_utilizator = @idUser";
                    using (var cmdVerif = new NpgsqlCommand(sqlVerifClient, connection))
                    {
                        cmdVerif.Parameters.AddWithValue("@idUser", idUserCurent.Value);
                        var resultClient = await cmdVerif.ExecuteScalarAsync();
                        if (resultClient == null)
                        {
                            return Forbid();
                        }
                        idClientFinal = Convert.ToInt32(resultClient);
                    }

                    using (var transaction = await connection.BeginTransactionAsync())
                    {
                        try
                        {
                            string sqlProiect = @"INSERT INTO ""PROIECT"" (id_client, titlu, descriere, buget, status, data_limita) 
                                VALUES (@idClient, @titlu, @descriere, @buget, 'Activ', @dataLimita) RETURNING id_proiect";
                            
                            int noulIdProiect;
                            using (var command = new NpgsqlCommand(sqlProiect, connection, transaction))
                            {
                                command.Parameters.AddWithValue("@idClient", idClientFinal);
                                command.Parameters.AddWithValue("@titlu", cerere.Titlu);
                                command.Parameters.AddWithValue("@descriere", cerere.Descriere ?? (object)DBNull.Value);
                                command.Parameters.AddWithValue("@buget", cerere.Buget ?? (object)DBNull.Value);
                                command.Parameters.AddWithValue("@dataLimita", cerere.DataLimita);
                                noulIdProiect = (int)await command.ExecuteScalarAsync();
                            }

                            if (cerere.Activitati != null && cerere.Activitati.Any())
                            {
                                foreach (var activitate in cerere.Activitati)
                                {
                                    int idCategorieFinal = 0;
                                    string sqlCautaCategorie = @"SELECT id_categorie FROM ""CATEGORIE"" WHERE LOWER(denumire) = LOWER(@denumire)";
                                    using (var cmdCauta = new NpgsqlCommand(sqlCautaCategorie, connection, transaction))
                                    {
                                        cmdCauta.Parameters.AddWithValue("@denumire", activitate.NumeCategorie.Trim());
                                        var result = await cmdCauta.ExecuteScalarAsync();
                                        if (result != null)
                                        {
                                            idCategorieFinal = Convert.ToInt32(result);
                                        }
                                        else
                                        {
                                            string sqlInsertCategorie = @"INSERT INTO ""CATEGORIE"" (denumire) VALUES (@denumire) RETURNING id_categorie;";
                                            using (var cmdInsert = new NpgsqlCommand(sqlInsertCategorie, connection, transaction))
                                            {
                                                cmdInsert.Parameters.AddWithValue("@denumire", activitate.NumeCategorie.Trim());
                                                idCategorieFinal = (int)await cmdInsert.ExecuteScalarAsync();
                                            }
                                        }
                                    }

                                    string textPentruEmbedding = $"{activitate.TitluActivitate} {activitate.Descriere} {activitate.NumeCategorie}";
                                    float[] embedding = await _embeddingService.GetEmbeddingAsync(textPentruEmbedding);
                                    string vectorString = "[" + string.Join(",", embedding.Select(f => f.ToString(System.Globalization.CultureInfo.InvariantCulture))) + "]";
                                    var vector = new NpgsqlParameter("@embedding", vectorString);
                                    
                                    string sqlActivitate = @"INSERT INTO ""ACTIVITATE"" (id_proiect, id_categorie, titlu_activitate, descriere, nr_maxim_freelanceri, embedding) 
                                        VALUES (@idProiect, @idCategorie, @titluActiv, @descActiv, @nrMaxFree, @embedding::vector);";
                                    using (var cmdActiv = new NpgsqlCommand(sqlActivitate, connection, transaction))
                                    {
                                        cmdActiv.Parameters.AddWithValue("@idProiect", noulIdProiect);
                                        cmdActiv.Parameters.AddWithValue("@idCategorie", idCategorieFinal);
                                        cmdActiv.Parameters.AddWithValue("@titluActiv", activitate.TitluActivitate);
                                        cmdActiv.Parameters.AddWithValue("@descActiv", activitate.Descriere ?? (object)DBNull.Value);
                                        cmdActiv.Parameters.AddWithValue("@nrMaxFree", activitate.NrMaximFreelanceri ?? (object)DBNull.Value);
                                        cmdActiv.Parameters.Add(vector);
                                        await cmdActiv.ExecuteNonQueryAsync();
                                    }
                                }
                            }
                            await transaction.CommitAsync();
                            return Ok(new { mesaj = "Proiectul a fost publicat cu succes.", idProiect = noulIdProiect });
                        }
                        catch (Exception)
                        {
                            await transaction.RollbackAsync();
                            throw;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { eroare = $"Eroare la salvare: {ex.Message}" });
            }
        }

        [HttpGet("client")]
        [Authorize]
        public async Task<IActionResult> GetProiecteClient()
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            var proiecte = new List<object>();
            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    string sqlClient = @"SELECT id_client FROM ""CLIENT"" WHERE id_utilizator = @idUser";
                    int idClientFinal = 0;
                    using (var cmdCli = new NpgsqlCommand(sqlClient, connection))
                    {
                        cmdCli.Parameters.AddWithValue("@idUser", idUserCurent.Value);
                        var res = await cmdCli.ExecuteScalarAsync();
                        if (res == null) return Forbid();
                        idClientFinal = Convert.ToInt32(res);
                    }

                    string sql = @"SELECT p.id_proiect, p.titlu, p.descriere, p.buget, p.status, p.data_limita, 
                    COALESCE ((SELECT COUNT(*) FROM ""ANGAJARE"" a JOIN ""ACTIVITATE"" act ON a.id_activitate = act.id_activitate WHERE act.id_proiect = p.id_proiect), 0) as nr_oferte 
                    FROM ""PROIECT"" p
                    WHERE p.id_client = @idClient 
                    ORDER BY p.id_proiect DESC";
                    
                    using (var command = new NpgsqlCommand(sql, connection))
                    {
                        command.Parameters.AddWithValue("@idClient", idClientFinal);
                        using (var reader = await command.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                proiecte.Add(new
                                {
                                    IdProiect = reader.GetInt32(0),
                                    Titlu = reader.GetString(1),
                                    Descriere = reader.IsDBNull(2) ? "" : reader.GetString(2),
                                    Buget = reader.IsDBNull(3) ? 0 : reader.GetDecimal(3),
                                    Status = reader.IsDBNull(4) ? "" : reader.GetString(4),
                                    DataLimita = reader.IsDBNull(5) ? null : reader.GetDateTime(5).ToString("yyyy-MM-dd"),
                                    NrOferte = reader.GetInt32(6)
                                });
                            }
                        }
                    }
                }
                return Ok(proiecte);
            }
            catch (Exception ex)
            {
                return BadRequest(new { mesaj = "Eroare la afișarea proiectelor: " + ex.Message });
            }
        }

        [HttpGet("{idProiect}/activitati")]
        [Authorize]
        public async Task<IActionResult> GetActivitatiProiectPentruEditare(int idProiect)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            var activitati = new List<ActivitateRequest>();
            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    string sqlProprietar = @"SELECT c.id_utilizator FROM ""PROIECT"" p JOIN ""CLIENT"" c ON p.id_client = c.id_client WHERE p.id_proiect = @idProiect";
                    using (var cmdProprietar = new NpgsqlCommand(sqlProprietar, connection))
                    {
                        cmdProprietar.Parameters.AddWithValue("@idProiect", idProiect);
                        var rezultat = await cmdProprietar.ExecuteScalarAsync();
                        if (rezultat == null) return NotFound(new { mesaj = "Proiectul nu există." });
                        if (Convert.ToInt32(rezultat) != idUserCurent.Value) return Forbid();
                    }

                    string sql = @"SELECT c.denumire, a.titlu_activitate, a.descriere, a.nr_maxim_freelanceri
                    FROM ""ACTIVITATE"" a
                    JOIN ""CATEGORIE"" c ON a.id_categorie = c.id_categorie
                    WHERE a.id_proiect = @idProiect";
                    using (var command = new NpgsqlCommand(sql, connection))
                    {
                        command.Parameters.AddWithValue("@idProiect", idProiect);
                        using (var reader = await command.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                activitati.Add(new ActivitateRequest
                                {
                                    NumeCategorie = reader.GetString(0),
                                    TitluActivitate = reader.GetString(1),
                                    Descriere = reader.IsDBNull(2) ? "" : reader.GetString(2),
                                    NrMaximFreelanceri = reader.IsDBNull(3) ? (int?)null : reader.GetInt32(3)
                                });
                            }
                        }
                    }
                }
                return Ok(activitati);
            }
            catch (Exception ex)
            {
                return BadRequest(new { mesaj = ex.Message });
            }
        }

        [HttpPut("editeaza/{idProiect}")]
        [Authorize]
        public async Task<IActionResult> EditeazaProiect(int idProiect, [FromBody] AdaugaProiectRequest cerere)
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

                    string sqlProprietar = @"SELECT c.id_utilizator FROM ""PROIECT"" p JOIN ""CLIENT"" c ON p.id_client = c.id_client WHERE p.id_proiect = @idProiect";
                    using (var cmdProprietar = new NpgsqlCommand(sqlProprietar, connection))
                    {
                        cmdProprietar.Parameters.AddWithValue("@idProiect", idProiect);
                        var rezultat = await cmdProprietar.ExecuteScalarAsync();
                        if (rezultat == null) return NotFound(new { mesaj = "Proiectul nu există." });
                        if (Convert.ToInt32(rezultat) != idUserCurent.Value) return Forbid();
                    }

                    using (var transaction = await connection.BeginTransactionAsync())
                    {
                        try
                        {
                            string sqlUpdateProiect = @"UPDATE ""PROIECT"" SET titlu = @titlu, descriere = @descriere, buget = @buget, data_limita = @dataLimita
                                WHERE id_proiect = @idProiect";
                            using (var command = new NpgsqlCommand(sqlUpdateProiect, connection, transaction))
                            {
                                command.Parameters.AddWithValue("@idProiect", idProiect);
                                command.Parameters.AddWithValue("@titlu", cerere.Titlu);
                                command.Parameters.AddWithValue("@descriere", cerere.Descriere ?? (object)DBNull.Value);
                                command.Parameters.AddWithValue("@buget", cerere.Buget ?? (object)DBNull.Value);
                                command.Parameters.AddWithValue("@dataLimita", cerere.DataLimita);
                                await command.ExecuteNonQueryAsync();
                            }

                            string sqlStergeActivitati = @"DELETE FROM ""ACTIVITATE"" WHERE id_proiect = @idProiect";
                            using (var cmdDel = new NpgsqlCommand(sqlStergeActivitati, connection, transaction))
                            {
                                cmdDel.Parameters.AddWithValue("@idProiect", idProiect);
                                await cmdDel.ExecuteNonQueryAsync();
                            }

                            if (cerere.Activitati != null && cerere.Activitati.Any())
                            {
                                foreach (var activitate in cerere.Activitati)
                                {
                                    int idCategorieFinal = 0;
                                    string sqlCautaCategorie = @"SELECT id_categorie FROM ""CATEGORIE"" WHERE LOWER (denumire) = LOWER (@denumire)";
                                    using (var cmdCauta = new NpgsqlCommand(sqlCautaCategorie, connection, transaction))
                                    {
                                        cmdCauta.Parameters.AddWithValue("@denumire", activitate.NumeCategorie.Trim());
                                        var result = await cmdCauta.ExecuteScalarAsync();
                                        if (result != null)
                                        {
                                            idCategorieFinal = Convert.ToInt32(result);
                                        }
                                        else
                                        {
                                            string sqlInsertCategorie = @"INSERT INTO ""CATEGORIE"" (denumire) VALUES (@denumire) RETURNING id_categorie;";
                                            using (var cmdInsert = new NpgsqlCommand(sqlInsertCategorie, connection, transaction))
                                            {
                                                cmdInsert.Parameters.AddWithValue("@denumire", activitate.NumeCategorie.Trim());
                                                idCategorieFinal = (int)await cmdInsert.ExecuteScalarAsync();
                                            }
                                        }
                                    }

                                    string textPentruEmbedding = $"{activitate.TitluActivitate} {activitate.Descriere} {activitate.NumeCategorie}";
                                    float[] embedding = await _embeddingService.GetEmbeddingAsync(textPentruEmbedding);
                                    string vectorString = "[" + string.Join(",", embedding.Select(f => f.ToString(System.Globalization.CultureInfo.InvariantCulture))) + "]";
                                    var vector = new NpgsqlParameter("@embedding", vectorString);
                                    
                                    string sqlActivitate = @"INSERT INTO ""ACTIVITATE"" (id_proiect, id_categorie, titlu_activitate, descriere, nr_maxim_freelanceri, embedding) 
                                        VALUES (@idProiect, @idCategorie, @titluActiv, @descActiv, @nrMaxFree, @embedding::vector);";
                                    using (var cmdActiv = new NpgsqlCommand(sqlActivitate, connection, transaction))
                                    {
                                        cmdActiv.Parameters.AddWithValue("@idProiect", idProiect);
                                        cmdActiv.Parameters.AddWithValue("@idCategorie", idCategorieFinal);
                                        cmdActiv.Parameters.AddWithValue("@titluActiv", activitate.TitluActivitate);
                                        cmdActiv.Parameters.AddWithValue("@descActiv", activitate.Descriere ?? (object)DBNull.Value);
                                        cmdActiv.Parameters.AddWithValue("@nrMaxFree", activitate.NrMaximFreelanceri ?? (object)DBNull.Value);
                                        cmdActiv.Parameters.Add(vector);
                                        await cmdActiv.ExecuteNonQueryAsync();
                                    }
                                }
                            }
                            await transaction.CommitAsync();
                            return Ok(new { mesaj = "Proiectul a fost editat cu succes" });
                        }
                        catch (Exception)
                        {
                            await transaction.RollbackAsync();
                            throw;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { eroare = $"Eroare la editare: {ex.Message}" });
            }
        }

        [HttpGet("activitati-disponibile")]
        [Authorize]
        public async Task<IActionResult> GetActivitatiDisponibile()
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            var activitati = new List<object>();
            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string sql = @"SELECT a.id_activitate, a.titlu_activitate, a.descriere, a.nr_maxim_freelanceri, c.denumire AS categorie, p.titlu AS titlu_proiect, p.buget, a.fisier_documentatie
                    FROM ""ACTIVITATE"" a
                    JOIN ""PROIECT"" p ON a.id_proiect = p.id_proiect
                    JOIN ""CATEGORIE"" c ON a.id_categorie = c.id_categorie
                    WHERE p.status = 'Activ'
                    AND (
                        a.nr_maxim_freelanceri IS NULL
                        OR (
                            SELECT COUNT(*) FROM ""ANGAJARE"" ang
                            WHERE ang.id_activitate = a.id_activitate
                            AND ang.status_plata NOT IN ('Anulat', 'Rambursat')
                        ) < a.nr_maxim_freelanceri
                    )
                    ORDER BY a.id_activitate DESC";
                    
                    using (var command = new NpgsqlCommand(sql, connection))
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            activitati.Add(new
                            {
                                IdActivitate = reader.GetInt32(0),
                                TitluActivitate = reader.GetString(1),
                                Descriere = reader.IsDBNull(2) ? "" : reader.GetString(2),
                                NrMaximFreelanceri = reader.IsDBNull(3) ? (int?)null : reader.GetInt32(3),
                                Categorie = reader.GetString(4),
                                TitluProiect = reader.GetString(5),
                                Buget = reader.IsDBNull(6) ? 0 : reader.GetDecimal(6),
                                FisierDocumentatie = reader.IsDBNull(7) ? null : reader.GetString(7)
                            });
                        }
                    }
                }
                return Ok(activitati);
            }
            catch (Exception ex)
            {
                return BadRequest(new { mesaj = "Eroare la afișarea activităților: " + ex.Message });
            }
        }

        [HttpDelete("{idProiect}")]
        [Authorize]
        public async Task<IActionResult> StergeProiect(int idProiect)
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

                    string sqlProprietar = @"SELECT c.id_utilizator FROM ""PROIECT"" p JOIN ""CLIENT"" c ON p.id_client = c.id_client WHERE p.id_proiect = @idProiect";
                    using (var cmdProprietar = new NpgsqlCommand(sqlProprietar, connection))
                    {
                        cmdProprietar.Parameters.AddWithValue("@idProiect", idProiect);
                        var rezultat = await cmdProprietar.ExecuteScalarAsync();
                        if (rezultat == null) return NotFound(new { mesaj = "Proiectul nu există." });
                        if (Convert.ToInt32(rezultat) != idUserCurent.Value) return Forbid();
                    }

                    using (var transaction = await connection.BeginTransactionAsync())
                    {
                        try
                        {
                            string sqlActivitati = @"DELETE FROM ""ACTIVITATE"" WHERE id_proiect = @idProiect";
                            using (var cmdAct = new NpgsqlCommand(sqlActivitati, connection, transaction))
                            {
                                cmdAct.Parameters.AddWithValue("@idProiect", idProiect);
                                await cmdAct.ExecuteNonQueryAsync();
                            }

                            string sqlProiect = @"DELETE FROM ""PROIECT"" WHERE id_proiect = @idProiect";
                            using (var cmdProj = new NpgsqlCommand(sqlProiect, connection, transaction))
                            {
                                cmdProj.Parameters.AddWithValue("@idProiect", idProiect);
                                int randuriAfectate = await cmdProj.ExecuteNonQueryAsync();
                                if (randuriAfectate == 0)
                                {
                                    await transaction.RollbackAsync();
                                    return NotFound(new { mesaj = "Proiectul nu a fost găsit" });
                                }
                            }
                            await transaction.CommitAsync();
                            return Ok(new { mesaj = "Proiectul și activitățile au fost șterse cu succes!" });
                        }
                        catch (Exception)
                        {
                            await transaction.RollbackAsync();
                            throw;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { mesaj = "Eroare la ștergerea proiectului " + ex.Message });
            }
        }

        [HttpGet("recomandate")]
        [Authorize]
        public async Task<IActionResult> GetActivitatiRecomandate()
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            var activitati = new List<object>();
            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    
                    string sqlEmbedding = @"SELECT f.embedding::text FROM ""FREELANCER"" f WHERE f.id_utilizator = @idUtilizator";
                    string? freelancerEmbedding = null;
                    
                    using (var cmd = new NpgsqlCommand(sqlEmbedding, connection))
                    {
                        cmd.Parameters.AddWithValue("@idUtilizator", idUserCurent.Value);
                        var result = await cmd.ExecuteScalarAsync();
                        if (result == null || result == DBNull.Value)
                        {
                            return BadRequest(new { mesaj = "Freelancer-ul nu are embedding generat." });
                        }
                        freelancerEmbedding = result.ToString();
                    }

                    string sql = @"SELECT a.id_activitate, a.titlu_activitate, a.descriere, a.nr_maxim_freelanceri, c.denumire AS categorie, p.titlu AS titlu_proiect,
                        p.buget, 1 - (a.embedding <=> @freelancerEmbedding::vector) AS similaritate,
                        a.fisier_documentatie
                        FROM ""ACTIVITATE"" a
                        JOIN ""PROIECT"" p ON a.id_proiect = p.id_proiect
                        JOIN ""CATEGORIE"" c ON a.id_categorie = c.id_categorie
                        WHERE p.status = 'Activ'
                        AND p.data_limita >= CURRENT_DATE
                        AND a.embedding IS NOT NULL
                        AND NOT EXISTS (
                            SELECT id_oferta FROM ""OFERTA"" o
                            JOIN ""FREELANCER"" f2 ON o.id_freelancer = f2.id_freelancer
                            WHERE o.id_activitate = a.id_activitate
                            AND f2.id_utilizator = @idutilizator
                            AND o.status NOT IN ('Respins')
                        )
                        AND (a.nr_maxim_freelanceri IS NULL OR(SELECT COUNT(*) FROM ""ANGAJARE"" ang
                            WHERE ang.id_activitate = a.id_activitate
                            AND ang.status_plata NOT IN ('Anulat', 'Rambursat')
                            ) < a.nr_maxim_freelanceri
                        )
                        ORDER BY a.embedding <=> @freelancerEmbedding::vector
                        LIMIT 20";
                    
                    using (var cmd2 = new NpgsqlCommand(sql, connection))
                    {
                        cmd2.Parameters.AddWithValue("@freelancerEmbedding", freelancerEmbedding);
                        cmd2.Parameters.AddWithValue("@idutilizator", idUserCurent.Value);
                        
                        using (var reader = await cmd2.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                activitati.Add(new
                                {
                                    IdActivitate = reader.GetInt32(0),
                                    TitluActivitate = reader.GetString(1),
                                    Descriere = reader.IsDBNull(2) ? "" : reader.GetString(2),
                                    NrMaximFreelanceri = reader.IsDBNull(3) ? (int?)null : reader.GetInt32(3),
                                    Categorie = reader.GetString(4),
                                    TitluProiect = reader.GetString(5),
                                    Buget = reader.IsDBNull(6) ? 0 : reader.GetDecimal(6),
                                    Similaritate = reader.GetDouble(7),
                                    FisierDocumentatie = reader.IsDBNull(8) ? null : reader.GetString(8)
                                });
                            }
                        }
                    }
                }
                return Ok(activitati);
            }
            catch (Exception ex)
            {
                return BadRequest(new { mesaj = "Eroare la recomandări: " + ex.Message });
            }
        }

        [HttpPost("activitate/{idActivitate}/documentatie")]
        [Authorize]
        public async Task<IActionResult> UploadDocumentatie(int idActivitate, [FromForm] IFormFile fisier)
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

                    string sqlProprietar = @"SELECT c.id_utilizator 
                        FROM ""ACTIVITATE"" a 
                        JOIN ""PROIECT"" p ON a.id_proiect = p.id_proiect 
                        JOIN ""CLIENT"" c ON p.id_client = c.id_client 
                        WHERE a.id_activitate = @idActivitate";
                    
                    using (var cmdProprietar = new NpgsqlCommand(sqlProprietar, connection))
                    {
                        cmdProprietar.Parameters.AddWithValue("@idActivitate", idActivitate);
                        var rezultat = await cmdProprietar.ExecuteScalarAsync();
                        if (rezultat == null) return NotFound(new { mesaj = "Activitatea nu există." });
                        if (Convert.ToInt32(rezultat) != idUserCurent.Value) return Forbid();
                    }

                    if (fisier == null || fisier.Length == 0)
                    {
                        return BadRequest(new { eroare = "Nu a fost încărcat niciun fișier valid." });
                    }
                    
                    string uploadsFolder = Path.Combine(_env.ContentRootPath, "Uploads");
                    if (!Directory.Exists(uploadsFolder))
                    {
                        Directory.CreateDirectory(uploadsFolder);
                    }
                    
                    string extensie = Path.GetExtension(fisier.FileName);
                    string numeFisierUnic = Guid.NewGuid().ToString() + extensie;
                    string caleFisierCompleta = Path.Combine(uploadsFolder, numeFisierUnic);
                    
                    using (var stream = new FileStream(caleFisierCompleta, FileMode.Create))
                    {
                        await fisier.CopyToAsync(stream);
                    }

                    string sql = @"UPDATE ""ACTIVITATE"" SET fisier_documentatie = @fisier WHERE id_activitate = @id";
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@fisier", numeFisierUnic);
                        cmd.Parameters.AddWithValue("@id", idActivitate);
                        await cmd.ExecuteNonQueryAsync();
                    }
                }
                return Ok(new { mesaj = "Documentatia a fost încărcată cu succes." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = "Eroare la upload: " + ex.Message });
            }
        }

        [HttpGet("{idProiect}/activitati-cu-id")]
        [Authorize]
        public async Task<IActionResult> GetActivitatiCuId(int idProiect)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            var activitati = new List<object>();
            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    string sqlProprietar = @"SELECT c.id_utilizator FROM ""PROIECT"" p JOIN ""CLIENT"" c ON p.id_client = c.id_client WHERE p.id_proiect = @idProiect";
                    using (var cmdProprietar = new NpgsqlCommand(sqlProprietar, connection))
                    {
                        cmdProprietar.Parameters.AddWithValue("@idProiect", idProiect);
                        var rezultat = await cmdProprietar.ExecuteScalarAsync();
                        if (rezultat == null) return NotFound(new { mesaj = "Proiectul nu există." });
                        if (Convert.ToInt32(rezultat) != idUserCurent.Value) return Forbid();
                    }

                    string sql = @"SELECT a.id_activitate, a.titlu_activitate
                    FROM ""ACTIVITATE"" a
                    WHERE a.id_proiect = @idProiect
                    ORDER BY a.id_activitate ASC";
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@idProiect", idProiect);
                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                activitati.Add(new
                                {
                                    idActivitate = reader.GetInt32(0),
                                    titluActivitate = reader.GetString(1)
                                });
                            }
                        }
                    }
                }
                return Ok(activitati);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { eroare = ex.Message });
            }
        }
    }
}