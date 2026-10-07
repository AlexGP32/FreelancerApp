namespace FreelancerApp.Server.Models;

public class TrimiteOfertaRequest
{
    public int IdActivitate { get; set; }    
    public string Descriere { get; set; }
    public string Link { get; set; }

    public decimal Pret { get; set; }

    public int Durata { get; set; }
}

public class AcceptaOfertaRequest
{
    public string AuthorizationId { get; set; }
}