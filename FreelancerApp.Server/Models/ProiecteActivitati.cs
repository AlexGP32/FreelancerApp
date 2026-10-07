namespace FreelancerApp.Server.Models;

using System.Numerics;
public class AdaugaProiectRequest
{
    public int IdClient { get; set; }
    public string Titlu { get; set; }
    public string? Descriere { get; set; }
    public decimal? Buget { get; set; }
    public DateTime DataLimita { get; set; }
    public List<ActivitateRequest>? Activitati { get; set; }



}
public class ActivitateRequest
{
    public string NumeCategorie { get; set; }
    public string TitluActivitate { get; set; }
    public string? Descriere { get; set; }
    public int? NrMaximFreelanceri { get; set; }

    public IFormFile? FisierDocumentatie { get; set; }
}