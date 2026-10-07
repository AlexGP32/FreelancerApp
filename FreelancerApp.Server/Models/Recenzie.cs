namespace FreelancerApp.Server.Models;

public class RecenzieRequest
{
    public int IdAngajare { get; set; }
    public string TipAutor { get; set; }
    public int Nota { get; set; }
    public string? Comentariu { get; set; }
}