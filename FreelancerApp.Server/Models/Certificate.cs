namespace FreelancerApp.Server.Models;

public class AdaugaCertificatRequest
{
    public int IdUser { get; set; }
    public string Tip { get; set; }
    public IFormFile Fisier { get; set; }
}
public class DecizieRequest
{
    public int IdCertificat { get; set; }
    public int IdUserExpert { get; set; }
    public bool Aprobat { get; set; }
    public string? Observatii { get; set; }
}
