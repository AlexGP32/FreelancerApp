export function GetAuthHeaders(){
    const token = localStorage.getItem("token");
    if(!token){
        throw new Error("Utilizatorul nu este autentificat.");
    }
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}