import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import "../CSS/Inregistrare-Logare.css";
import { GetAuthHeaders } from "../TokenHeaders";

// Component that allows an already registered user to add or switch to a new role.
// E.g., A 'Client' can become a 'Freelancer' by providing the missing professional details.
export default function SchimbareRol() {
    const navigate = useNavigate();
    
    // --- State Management ---
    const [rolCurent, setRolCurent] = useState(""); // The user's current role
    const [rolNou, setRolNou] = useState(""); // The new role the user wants to adopt
    
    // Role-specific fields
    const [cnpCui, setCnpCui] = useState(""); // For Client
    const [iban, setIban] = useState(""); // For Freelancer
    const [profesie, setProfesie] = useState(""); // For Freelancer
    const [departament, setDepartament] = useState(""); // For ExpertLegal
    const [codLegitimatie, setCodLegitimatie] = useState(""); // For ExpertLegal
    const [codAdmin, setCodAdmin] = useState(""); // For Admin

    // Check if user is logged in and retrieve their current role from localStorage
    useEffect(() => {
        const userSalvat = localStorage.getItem("utilizatorLogat");
        if (userSalvat) {
            const user = JSON.parse(userSalvat);
            setRolCurent(user.rol);
        } else {
            navigate("/autentificare");
        }
    }, [navigate]);

    // Validates the inputs based on the newly selected role
    const valideazaFormular = () => {
        if (!rolNou) {
            return "Te rog selectează un rol nou.";
        }

        // --- Client Validation ---
        if (rolNou === "Client") {
            const valoare = cnpCui.trim().toUpperCase();
            if (!valoare) {
                return "Completează CNP sau CUI.";
            }
            
            // Modulo 11 validation for Romanian CNP
            const validareCNP = (cnpText) => {
                if (cnpText.length !== 13 || !/^[1-9]\d{12}$/.test(cnpText)) {
                    return false;
                }
                const coeficienti = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9]
                let suma = 0;
                for (let i = 0; i < 12; i++) {
                    suma += parseInt(cnpText.charAt(i)) * coeficienti[i];
                }
                let rest = suma % 11;
                let cifraControlCalculata;
                if (rest === 10) {
                    cifraControlCalculata = 1;
                } else {
                    cifraControlCalculata = rest;
                }
                let cifraControlReala = parseInt(cnpText.charAt(12));
                if (cifraControlCalculata === cifraControlReala) {
                    return true;
                } else {
                    return false;
                }
            }
            
            // Modulo 11 validation for Romanian CUI
            const validareCUI = (cuiText) => {
                let curatat = cuiText.replace(/^RO/i, '');
                if (!/^\d{2,10}$/.test(curatat)) {
                    return false
                }
                const coeficientiCUI = [7, 5, 3, 2, 1, 7, 5, 3, 2]
                let cifraControlReala = parseInt(curatat.charAt(curatat.length - 1));
                let numarFaraControl = curatat.substring(0, curatat.length - 1);
                let suma = 0;
                let j = coeficientiCUI.length - 1;
                for (let i = numarFaraControl.length - 1; i >= 0; i--) {
                    suma += parseInt(numarFaraControl.charAt(i)) * coeficientiCUI[j];
                    j--;
                }
                let rest = (suma * 10) % 11;
                let cifraControlCalculata;
                if (rest === 10) {
                    cifraControlCalculata = 0;
                } else {
                    cifraControlCalculata = rest;
                }
                if (cifraControlCalculata === cifraControlReala) {
                    return true;
                }
                else {
                    return false;
                }
            };
            
            // Fails if neither CNP nor CUI is mathematically valid
            if (!validareCNP(valoare) && !validareCUI(valoare)) {
                return "CUI-ul sau CNP-ul introdus este invalid (cifra de control nu corespunde).";
            }
        }

        // --- Freelancer Validation ---
        if (rolNou === "Freelancer") {
            if (!profesie || !iban) {
                return "Completează profesia și IBAN-ul.";
            }
            
            // Modulo 97 validation for IBAN
            const validareIBAN = (ibanText) => {
                let iban = ibanText.replace(/\s+/g, '').toUpperCase();
                if (!/^RO\d{2}[A-Z0-9]{20}$/.test(iban)) {
                    return false;
                }
                let rearanjat = iban.substring(4) + iban.substring(0, 4);
                let numericIban = "";
                for (let i = 0; i < rearanjat.length; i++) {
                    let charCode = rearanjat.charCodeAt(i);
                    if (charCode >= 65 && charCode <= 90) {
                        numericIban += (charCode - 55).toString();
                    } else {
                        numericIban += rearanjat.charAt(i);
                    }
                }
                let rest = BigInt(numericIban) % 97n;
                if (rest === 1n) {
                    return true;
                } else {
                    return false;
                }
            };
            if (!validareIBAN(iban)) {
                return "Codul IBAN introdus nu este valid matematic.";
            }
            const profesieRegex = /^[a-zA-ZăâîșțĂÂÎȘȚ\s-]+$/;
            if (!profesieRegex.test(profesie)) {
                return "Profesie invalidă. Folosește doar litere.";
            }
        }

        // --- Expert Legal Validation ---
        if (rolNou === "ExpertLegal") {
            if (!departament || !codLegitimatie) {
                return "Completează departamentul și codul de legitimație.";
            }
            if (departament.trim().length < 3) {
                return "Denumirea departamentului este prea scurtă.";
            }
            if (codLegitimatie.length < 4 || codLegitimatie.length > 15) {
                return "Codul legitimației trebuie să aibă între 4 și 15 caractere."
            }
            const codRegex = /^[a-zA-Z0-9-]+$/;
            if (!codRegex.test(codLegitimatie)) {
                return "Codul legitimației poate conține doar litere, cifre și cratimă. ";
            }
        }

        // --- Admin Validation ---
        if (rolNou === "Admin" && !codAdmin) {
            return "Introdu codul administratorului.";
        }
        
        return null; // No errors
    };

    // Submits the new role data to the backend
    const handleSubmit = async (e) => {
        e.preventDefault();
        const eroare = valideazaFormular();
        if (eroare) {
            Swal.fire({
                icon: "error",
                title: "Eroare",
                text: eroare,
                confirmButtonColor: "red"
            });
            return;
        }
        
        // Build the payload depending on which new role the user selected
        let dateRol = { rolNou };
        if (rolNou === "Client") {
            dateRol = { ...dateRol, cnpCui: cnpCui.toUpperCase() };
        } else if (rolNou === "Freelancer") {
            dateRol = { ...dateRol, iban: iban.replace(/\s/g, "").toUpperCase(), profesie };
        } else if (rolNou === "ExpertLegal") {
            dateRol = { ...dateRol, departament, codLegitimatie: codLegitimatie.toUpperCase() };
        } else if (rolNou === "Admin") {
            dateRol = { ...dateRol, codAdmin };
        }
        
        const linkApi = "http://localhost:5129/api/Utilizator/schimbare-rol";
        try {
            const raspuns = await fetch(linkApi, {
                method: "POST",
                headers: GetAuthHeaders(),
                body: JSON.stringify(dateRol)
            });
            
            if (raspuns.ok) {
                await Swal.fire({
                    icon: "success",
                    title: "Succes !",
                    text: `Profilul tău de ${rolNou} a fost creat cu succes.`
                });
                
                // Update the local storage so the dashboard immediately renders the new role
                const userLocal = JSON.parse(localStorage.getItem("utilizatorLogat"));
                localStorage.setItem("utilizatorLogat", JSON.stringify({ ...userLocal, rol: rolNou }));
                navigate("/panou");
            } else {
                const textEroare = await raspuns.text();
                Swal.fire({
                    icon: "error",
                    title: "Eroare Server",
                    text: textEroare,
                });
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                icon: "warning",
                title: "Problemă",
                text: "Eroare la trimiterea datelor către server."
            });
        }
    }

    return (
        <div className="register-container">
            <form className="register-form" onSubmit={handleSubmit} noValidate>
                <h2> Schimbare Rol </h2>
                <div>
                    Ești autentificat curent ca: <strong> {rolCurent} </strong>
                </div>

                {/* Role Selection Dropdown */}
                <label>
                    <span>
                        Alege Noul Rol: <span className="required"> * </span>
                    </span>
                    <select value={rolNou} onChange={(e) => setRolNou(e.target.value)}>
                        <option value=""> Selectează un rol </option>
                        {/* Hide the user's current role from the dropdown options */}
                        {rolCurent !== "Client" && <option value="Client"> Client  </option>}
                        {rolCurent !== "Freelancer" && <option value="Freelancer">Freelancer</option>}
                        {rolCurent !== "ExpertLegal" && <option value="ExpertLegal"> Expert Legal </option>}
                        <option value="Admin"> Administrator </option>
                    </select>
                </label>

                {/* Conditionally render fields based on the chosen new role */}
                {rolNou === "Client" && (
                    <label>
                        <span>
                            CNP/CUI <span className="required"> * </span>
                            <span className="info-icon" title="Codul unic de înregistrare pentru firme sau pentru persoane fizice."> ⓘ </span>
                        </span>
                        <input type="text" value={cnpCui || ""} onChange={(e) => setCnpCui(e.target.value)} placeholder="2990219469000 (CNP)/14399840 (CUI)" />
                    </label>
                )}

                {rolNou === "Freelancer" && (
                    <>
                        <label>
                            <span>
                                Profesie : <span className="required"> * </span>
                            </span>
                            <input type="text" value={profesie || ""} onChange={(e) => setProfesie(e.target.value)} placeholder="Ex: Programator Web, Designer..." />
                        </label>
                        <label>
                            <span>
                                IBAN : <span className="required"> * </span>
                                <span className="info-icon" title="Contul bancar unde vei primi plățile pentru proiectele finalizate."> ⓘ </span>
                            </span>
                            <input type="text" value={iban || ""} onChange={(e) => setIban(e.target.value)} placeholder="RO49AAAA1B31007593840000" />
                        </label>
                    </>
                )}

                {rolNou === "ExpertLegal" && (
                    <>
                        <label>
                            <span>
                                Departament: <span className="required"> * </span>
                            </span>
                            <input type="text" value={departament || ""} onChange={(e) => setDepartament(e.target.value)} placeholder="LEG-1234" />
                        </label>
                        <label>
                            <span>
                                Cod Legitimație: <span className="required"> * </span>
                            </span>
                            <input type="text" value={codLegitimatie || ""} onChange={(e) => setCodLegitimatie(e.target.value)} placeholder="B-12345" />
                        </label>
                    </>
                )}

                {rolNou === "Admin" && (
                    <label>
                        <span>
                            Cod Admin: <span className="required"> * </span>
                        </span>
                        <input type="password" value={codAdmin} onChange={(e) => setCodAdmin(e.target.value)} placeholder="Introdu codul" />
                    </label>
                )}

                <div className="schimbare-butoane">
                    <button type="button" onClick={() => navigate("/panou")}> Înapoi la Panou </button>
                    {rolNou && <button type="submit"> Adaugă profilul de {rolNou} </button>}
                </div>
            </form >
        </div >
    );
}