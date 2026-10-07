using Microsoft.AspNetCore.Mvc;
using Npgsql;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;

namespace FreelancerApp.Server.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class FacturaController : ControllerBase
    {
        private readonly string _connectionString = string.Empty;
        private readonly ILogger<FacturaController> _logger;

        public FacturaController(IConfiguration configuration, ILogger<FacturaController> logger)
        {
            _connectionString = configuration.GetConnectionString("LicentaBaza");
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

        [HttpGet("{idAngajare}/descarca")]
        public async Task<IActionResult> DescarcaFactura(int idAngajare)
        {
            var idUserCurent = GetIdUtilizatorCurent();
            if (idUserCurent == null)
            {
                return Unauthorized(new { eroare = "Token invalid." });
            }

            try
            {
                string numeClient = "";
                string numeFreelancer = "";
                string titluProiect = "";
                string titluActivitate = "";
                decimal suma = 0;
                DateTime dataPlatii = DateTime.Now;
                string idTranzactie = "";
                int idUtilizatorClient = 0;
                int idUtilizatorFreelancer = 0;

                using (var connection = new NpgsqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    string sql = @"SELECT uc.nume AS numeClient, 
                    uf.nume AS numeFreelancer,
                    p.titlu AS titluProiect,
                    a.titlu AS titluActivitate,
                    pc.suma,
                    a.data_angajarii,
                    a.id_autorizare_plata,
                    uc.id_utilizator AS idUtilizatorClient,
                    uf.id_utilizator AS idUtilizatorFreelancer
                    FROM ""ANGAJARE"" a
                    JOIN ""FREELANCER"" f ON a.id_freelancer = f.id_freelancer
                    JOIN  ""UTILIZATOR"" uf ON f.id_utilizator = uf.id_utilizator
                    JOIN ""ACTIVITATE"" act ON a.id_activitate = act.id_activitate
                    JOIN ""PROIECT"" p ON act.id_proiect = p.id_proiect
                    JOIN ""CLIENT"" c ON p.id_client = c.id_client
                    JOIN ""UTILIZATOR"" uc ON c.id_utilizator  = uc.id_utilizator
                    JOIN ""PLATA_CONDITIONATA"" pc ON pc.id_autorizare_plata = a.id_autorizare_plata
                    WHERE a.id_angajare = @idAngajare";
                    using (var cmd = new NpgsqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@idAngajare", idAngajare);
                        using var reader = await cmd.ExecuteReaderAsync();
                        if (await reader.ReadAsync())
                        {
                            numeClient = reader.GetString(0);
                            numeFreelancer = reader.GetString(1);
                            titluProiect = reader.GetString(2);
                            titluActivitate = reader.GetString(3);
                            suma = reader.GetDecimal(4);
                            dataPlatii = reader.GetDateTime(5);
                            idTranzactie = reader.IsDBNull(6) ? "nu a fost găsit" : reader.GetString(6);
                            idUtilizatorClient = reader.GetInt32(7);
                            idUtilizatorFreelancer = reader.GetInt32(8);
                        }
                        else
                        {
                            return NotFound(new { eroare = "Angajarea nu a fost găsită." });
                        }
                    }
                }
                bool esteParteImplicata = idUserCurent.Value == idUtilizatorClient || idUserCurent.Value == idUtilizatorFreelancer;
                bool esteExpertLegal = GetRolCurent() == "Expert_Legal";
                if (!esteParteImplicata && !esteExpertLegal)
                {
                    return Forbid();
                }

                var pdf = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.Margin(2, Unit.Centimetre);
                        page.DefaultTextStyle(x => x.FontSize(12));
                        page.Header().Text("FACTURĂ").SemiBold().FontSize(24).AlignCenter();
                        page.Content().Column(col =>
                        {
                            col.Spacing(10);
                            col.Item().Text($"Data plății: {dataPlatii:dd.MM.yyyy}");
                            col.Item().Text($"ID Tranzacție PayPal: {idTranzactie}");
                            col.Item().LineHorizontal(1);
                            col.Item().Text("Detalii părți:").SemiBold();
                            col.Item().Text($"Client: {numeClient}");
                            col.Item().Text($"Freelancer: {numeFreelancer}");
                            col.Item().LineHorizontal(1);
                            col.Item().Text("Detalii lucrare:").SemiBold();
                            col.Item().Text($"Proiect: {titluProiect}");
                            col.Item().Text($"Activitate: {titluActivitate}");
                            col.Item().LineHorizontal(1);
                            col.Item().Text($"Sumă plătită: {suma} EUR").SemiBold().FontSize(14);
                        });
                        page.Footer().Text($"Factură generată prin QuestPDF - Freelancerapp")
                            .FontSize(9).FontColor(Colors.Grey.Medium).AlignCenter();
                    });
                });
                var pdfBytes = pdf.GeneratePdf();
                return File(pdfBytes, "application/pdf", $"Factura_{idAngajare}.pdf");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Eroare la generarea facturii pentru angajarea {IdAngajare}.", idAngajare);
                return StatusCode(500, new { eroare = "Eroare la generarea facturii." });
            }
        }
    }
}