namespace FreelancerApp.Server.Models;

public class CreareComanda
{
    public int IdOferta { get; set; }
    public decimal Pret { get; set; }
    public string Descriere { get; set; } = "";
}

public class FinalizareComanda
{
    public string OrderID { get; set; } = "";
}