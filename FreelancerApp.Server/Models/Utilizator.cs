namespace FreelancerApp.Server.Models;

public class DateInregistrare
{
    public string Nume { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Parola { get; set; } = string.Empty;
    public string? Telefon { get; set; }
    public string Judet { get; set; } = string.Empty;
    public string Oras { get; set; } = string.Empty;
    public string Strada { get; set; } = string.Empty;
    public string Numar { get; set; } = string.Empty;


}
public class InregistrareClientRequest : DateInregistrare
{
    public string CnpCui { get; set; } = string.Empty;
}

public class InregistrareFreelancerRequest : DateInregistrare
{
    public string Iban { get; set; } = string.Empty;
    public string Profesie { get; set; } = string.Empty;
}

public class InregistrareExpertRequest : DateInregistrare
{
    public string Departament { get; set; } = string.Empty;
    public string CodLegitimatie { get; set; } = string.Empty;
}

public class InregistrareAdminRequest : DateInregistrare
{
    public string codAdmin { get; set; } = string.Empty;
}

public class LoginRequest
{
    public string Identificator { get; set; } = string.Empty;
    public string Parola { get; set; } = string.Empty;
    public string Rol { get; set; } = string.Empty;
}
public class ActualizareDateRequest
{
    public int IdUser { get; set; }
    public string Nume { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Parola { get; set; }
    public string? Telefon { get; set; }
    public string Judet { get; set; } = string.Empty;
    public string Oras { get; set; } = string.Empty;
    public string Strada { get; set; } = string.Empty;
    public string Numar { get; set; } = string.Empty;
    public string? CnpCui { get; set; }
    public string? Iban { get; set; }
    public string? Profesie { get; set; }
    public string? Departament { get; set; }
    public string? CodLegitimatie { get; set; }
}

public class SchimbareRolRequest
{
    public int IdUser { get; set; }
    public string RolNou { get; set; } = string.Empty;
    public string? CnpCui { get; set; }
    public string? Iban { get; set; }
    public string? Profesie { get; set; }
    public string? Departament { get; set; }
    public string? CodLegitimatie { get; set; }
    public string? CodAdmin { get; set; }
}
