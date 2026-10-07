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
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class OferteController : ControllerBase
    {
        private readonly string _connectionString = string.Empty;
        public OferteController(IConfiguration configuration)
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

        private string? GetRolCurent()
        {
            return User.FindFirst("rol")?.Value;
        }

        [HttpPost]
        public async Task<IActionResult> TrimiteOferta([FromBody] TrimiteOfertaRequest cerere)
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
                    string sqlFindFreelancer = @"SELECT id_freelancer FROM ""FREELANCER"" WHERE id_utilizator = @idUser LIMIT 1";
                    int idFreelancerFinal = 0;
                    using (var cmdFind = new NpgsqlCommand(sqlFindFreelancer, connection))
                    {
                        cmdFind.Parameters.AddWithValue("@idUser", idUserCurent.Value);
                        var result = await cmdFind.ExecuteScalarAsync();
                        if (result == null)
                        {
                            return NotFound(new { message = "Nu s-a găsit un profil de freelancer asociat acestui cont." });
                        }
                        idFreelancerFinal = Convert.ToInt32(result);
                    }
                    string sqlProprietarProiect = @"
                        SELECT c.id_utilizator
                        FROM ""ACTIVITATE"" a
                        JOIN ""PROIECT"" p ON a.id_proiect = p.id_proiect
                        JOIN ""CLIENT"" c ON p.id_client = c.id_client
                        WHERE a.id_activitate = @idAct";
                    using (var cmdProp = new NpgsqlCommand(sqlProprietarProiect, connection))
                    {
                        cmdProp.Parameters.AddWithValue("@idAct", cerere.IdActivitate);
                        var idUtilizatorProprietar = await cmdProp.ExecuteScalarAsync();
                        if (idUtilizatorProprietar == null)
                        {
                            return NotFound(new { message = "Activitatea nu a fost găsită." });
                        }
                        if (Convert.ToInt32(idUtilizatorProprietar) == idUserCurent.Value)
                        {
                            return BadRequest(new { message = "Nu poți aplica la propriul tău proiect." });
                        }
                    }
                    string sqlCheckDuplicate = @"SELECT COUNT(*) FROM ""OFERTA"" WHERE id_activitate = @idAct AND id_freelancer = @idFree AND status NOT IN ('Respins')";
                    using (var cmdCheck = new NpgsqlCommand(sqlCheckDuplicate, connection))
                    {
                        cmdCheck.Parameters.AddWithValue("@idAct", cerere.IdActivitate);
                        cmdCheck.Parameters.AddWithValue("@idFree", idFreelancerFinal);
                        long count = (long)await cmdCheck.ExecuteScalarAsync();
                        if (count > 0)
                        {
                            return BadRequest(new { message = "Ai aplicat deja la acest job!" });
                        }
                    }
                    string sqlInsert = @"INSERT INTO ""OFERTA""(id_activitate, id_freelancer,  mesaj, data_ofertarii, status, pret, durata, link) VALUES(@idAct, @idFree, @mesaj, @data, 'În Așteptare', @pret, @durata, @link)";
                    using (var cmdInsert = new NpgsqlCommand(sqlInsert, connection))
                    {
                        cmdInsert.Parameters.AddWithValue("@idAct", cerere.IdActivitate);
                        cmdInsert.Parameters.AddWithValue("@idFree", idFreelancerFinal);
                        cmdInsert.Parameters.AddWithValue("@mesaj", cerere.Descriere);
                        cmdInsert.Parameters.AddWithValue("@data", DateTime.Now);
                        cmdInsert.Parameters.AddWithValue("@pret", cerere.Pret);
                        cmdInsert.Parameters.AddWithValue("@durata", cerere.Durata);
                        cmdInsert.Parameters.AddWithValue("@link", cerere.Link);
                        await cmdInsert.ExecuteNonQueryAsync();
                    }
                    return Ok(new { mesaj = "Oferta ta a fost înregistrată cu succes." });
                }
            }
            catch (Exception)
            {
                return StatusCode(500, new { message = "Eroare la procesarea ofertei" });
            }
        }

        [HttpGet("client")]
        public async Task<IActionResult> GetOfertePentruClient()
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }
            try
            {
                var oferte = new List<object>();
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string sqlFindClient = @"SELECT id_client FROM ""CLIENT"" WHERE id_utilizator = @idUser LIMIT 1";
                    int idClient;
                    using (var cmdFind = new NpgsqlCommand(sqlFindClient, connection))
                    {
                        cmdFind.Parameters.AddWithValue("@idUser", idUserCurent.Value);
                        var result = await cmdFind.ExecuteScalarAsync();
                        if (result == null)
                        {
                            return NotFound(new { eroare = "Nu s-a găsit un profil de client asociat acestui cont." });
                        }
                        idClient = Convert.ToInt32(result);
                    }

                    string sql = @"SELECT o.id_oferta, o.mesaj, o.data_ofertarii, o.status, a.titlu_activitate, p.titlu as titlu_proiect, u.nume, o.pret, p.buget
                    FROM ""OFERTA"" o
                    JOIN ""ACTIVITATE"" a ON o.id_activitate = a.id_activitate
                    JOIN ""PROIECT"" p ON a.id_proiect = p.id_proiect
                    JOIN ""FREELANCER"" f ON o.id_freelancer = f.id_freelancer
                    JOIN ""UTILIZATOR"" u ON f.id_utilizator = u.id_utilizator
                    WHERE p.id_client = @idClient
                    AND o.status = @status";
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@idClient", idClient);
                        cmd.Parameters.AddWithValue("@status", "În Așteptare");
                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                oferte.Add(new
                                {
                                    idOferta = reader.GetInt32(0),
                                    mesaj = reader.GetString(1),
                                    dataOfertarii = reader.GetDateTime(2),
                                    status = reader.GetString(3),
                                    titluActivitate = reader.GetString(4),
                                    titluProiect = reader.GetString(5),
                                    numeFreelancer = reader.GetString(6),
                                    pret = reader.GetDecimal(7),
                                    buget = reader.GetDecimal(8)
                                });
                            }
                        }
                    }
                    return Ok(oferte);
                }
            }
            catch (Exception)
            {
                return StatusCode(500, new { eroare = "Eroare la aducerea ofertelor" });
            }
        }
        [HttpPost("accepta/{idOferta}")]
        public async Task<IActionResult> AcceptaOferta(int idOferta, [FromBody] AcceptaOfertaRequest request)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }
            if (request == null || string.IsNullOrEmpty(request.AuthorizationId))
            {
                return BadRequest(new { eroare = "ID-ul de autorizare PayPal lipsește." });
            }
            try
            {
                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string sqlProprietarOferta = @"
                        SELECT c.id_utilizator
                        FROM ""OFERTA"" o
                        JOIN ""ACTIVITATE"" a ON o.id_activitate = a.id_activitate
                        JOIN ""PROIECT"" p ON a.id_proiect = p.id_proiect
                        JOIN ""CLIENT"" c ON p.id_client = c.id_client
                        WHERE o.id_oferta = @idOferta";
                    using (var cmdProp = new NpgsqlCommand(sqlProprietarOferta, connection))
                    {
                        cmdProp.Parameters.AddWithValue("@idOferta", idOferta);
                        var idUtilizatorProprietar = await cmdProp.ExecuteScalarAsync();
                        if (idUtilizatorProprietar == null)
                        {
                            return NotFound(new { mesaj = "Oferta nu a fost găsită" });
                        }
                        if (Convert.ToInt32(idUtilizatorProprietar) != idUserCurent.Value)
                        {
                            return Forbid();
                        }
                    }
                    using (var transaction = await connection.BeginTransactionAsync())
                    {
                        try
                        {
                            string sqlUpdateOferta = @"UPDATE ""OFERTA"" SET status = 'Acceptat' WHERE id_oferta = @idOferta AND status = 'În Așteptare' RETURNING id_activitate, id_freelancer, mesaj";
                            int idActivitate = 0;
                            int idFreelancer = 0;
                            string mesaj = "";
                            using (var cmdUpdateOferta = new NpgsqlCommand(sqlUpdateOferta, connection, transaction))
                            {
                                cmdUpdateOferta.Parameters.AddWithValue("@idOferta", idOferta);
                                using (var reader = await cmdUpdateOferta.ExecuteReaderAsync())
                                {
                                    if (await reader.ReadAsync())
                                    {
                                        idActivitate = reader.GetInt32(0);
                                        idFreelancer = reader.GetInt32(1);
                                        mesaj = reader.GetString(2);
                                    }
                                    else
                                    {
                                        return NotFound(new { mesaj = "Oferta nu a fost găsită sau a fost deja procesată." });
                                    }
                                }
                            }
                            string titluActivitate = "";
                            string sqlGetTitlu = @"SELECT titlu_activitate FROM ""ACTIVITATE"" WHERE id_activitate = @idAct";
                            using (var cmdTitlu = new NpgsqlCommand(sqlGetTitlu, connection, transaction))
                            {
                                cmdTitlu.Parameters.AddWithValue("@idAct", idActivitate);
                                var rezultat = await cmdTitlu.ExecuteScalarAsync();
                                titluActivitate = rezultat?.ToString() ?? "Contract Activ";
                            }
                            string sqlInsertAngajare = @"INSERT INTO ""ANGAJARE""(id_activitate, id_freelancer, titlu, descriere, link, data_angajarii, id_autorizare_plata, status_plata) VALUES(@idAct, @idFree, @titlu, @descriere, @link, @data, @idAuth, @statusPlata)";
                            using (var cmdInsert = new NpgsqlCommand(sqlInsertAngajare, connection, transaction))
                            {
                                cmdInsert.Parameters.AddWithValue("@idAct", idActivitate);
                                cmdInsert.Parameters.AddWithValue("@idFree", idFreelancer);
                                cmdInsert.Parameters.AddWithValue("@descriere", mesaj);
                                cmdInsert.Parameters.AddWithValue("@data", DateTime.Now);
                                cmdInsert.Parameters.AddWithValue("@titlu", titluActivitate);
                                cmdInsert.Parameters.AddWithValue("@link", DBNull.Value);
                                cmdInsert.Parameters.AddWithValue("@idAuth", request.AuthorizationId);
                                cmdInsert.Parameters.AddWithValue("@statusPlata", "Autorizat");
                                await cmdInsert.ExecuteNonQueryAsync();
                            }
                            string sqlGetProiect = @"SELECT a.id_proiect, o.pret
                            FROM ""OFERTA"" o
                            JOIN ""ACTIVITATE"" a ON o.id_activitate = a.id_activitate
                            WHERE o.id_oferta = @idOferta";
                            int id_proiect = 0;
                            decimal pret = 0;
                            using (var cmdProiect = new NpgsqlCommand(sqlGetProiect, connection, transaction))
                            {
                                cmdProiect.Parameters.AddWithValue("@idOferta", idOferta);
                                using (var readerProiect = await cmdProiect.ExecuteReaderAsync())
                                {
                                    if (await readerProiect.ReadAsync())
                                    {
                                        id_proiect = readerProiect.GetInt32(0);
                                        pret = readerProiect.GetDecimal(1);
                                    }
                                }
                            }
                            string sqlInsertPlata = @"INSERT INTO ""PLATA_CONDITIONATA""(id_proiect, suma, status, id_autorizare_plata)
                            VALUES (@idProiect, @suma, 'Blocata', @idAuth)";
                            using (var cmdPlata = new NpgsqlCommand(sqlInsertPlata, connection, transaction))
                            {
                                cmdPlata.Parameters.AddWithValue("@idProiect", id_proiect);
                                cmdPlata.Parameters.AddWithValue("@suma", pret);
                                cmdPlata.Parameters.AddWithValue("@idAuth", request.AuthorizationId);
                                await cmdPlata.ExecuteNonQueryAsync();
                            }
                            string sqlUpdateLocuri = @"UPDATE ""ACTIVITATE"" SET nr_maxim_freelanceri = nr_maxim_freelanceri - 1
                            WHERE id_activitate = @idAct AND nr_maxim_freelanceri > 0";
                            using (var cmdUpdateLoc = new NpgsqlCommand(sqlUpdateLocuri, connection, transaction))
                            {
                                cmdUpdateLoc.Parameters.AddWithValue("@idAct", idActivitate);
                                await cmdUpdateLoc.ExecuteNonQueryAsync();
                            }
                            await transaction.CommitAsync();
                        }
                        catch (Exception)
                        {
                            await transaction.RollbackAsync();
                            throw;
                        }
                    }
                }
                return Ok(new { mesaj = "Oferta a fost acceptată și angajarea a fost creată." });
            }
            catch (Exception)
            {
                return StatusCode(500, new { eroare = "Eroare la acceptare" });
            }
        }

        [HttpPost("respinge/{idOferta}")]
        public async Task<IActionResult> RespingeOferta(int idOferta)
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
                    string sqlProprietarOferta = @"
                        SELECT c.id_utilizator
                        FROM ""OFERTA"" o
                        JOIN ""ACTIVITATE"" a ON o.id_activitate = a.id_activitate
                        JOIN ""PROIECT"" p ON a.id_proiect = p.id_proiect
                        JOIN ""CLIENT"" c ON p.id_client = c.id_client
                        WHERE o.id_oferta = @idOferta";
                    using (var cmdProp = new NpgsqlCommand(sqlProprietarOferta, connection))
                    {
                        cmdProp.Parameters.AddWithValue("@idOferta", idOferta);
                        var idUtilizatorProprietar = await cmdProp.ExecuteScalarAsync();
                        if (idUtilizatorProprietar == null)
                        {
                            return NotFound(new { mesaj = "Oferta nu există." });
                        }
                        if (Convert.ToInt32(idUtilizatorProprietar) != idUserCurent.Value)
                        {
                            return Forbid();
                        }
                    }
                    string sqlUpdateOferta = @"UPDATE ""OFERTA"" SET status = 'Respins' WHERE id_oferta = @idOferta AND status = 'În Așteptare'";
                    using (var cmdUpdate = new NpgsqlCommand(sqlUpdateOferta, connection))
                    {
                        cmdUpdate.Parameters.AddWithValue("@idOferta", idOferta);
                        int affectedRows = await cmdUpdate.ExecuteNonQueryAsync();
                        if (affectedRows == 0)
                        {
                            return NotFound(new { mesaj = "Oferta nu există sau a fost deja procesată." });
                        }
                    }
                }
                return Ok(new { mesaj = "Oferta a fost respinsă." });
            }
            catch (Exception)
            {
                return StatusCode(500, new { eroare = "Eroare la respingere" });
            }
        }
    }
}