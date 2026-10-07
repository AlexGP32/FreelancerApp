import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import ProiecteActive from "./ProiecteActive";
import '../CSS/Panou.css'
import { GetAuthHeaders } from "../TokenHeaders";
import { handleAdaugaRecenzie } from "../AdaugaRecenzie";

// Main Dashboard for the 'Freelancer' role.
// Features include: Managing their expertise certificate (required to bid),
// viewing matched/available jobs, submitting offers, and viewing completed jobs.
export default function PanouFreelancer({ utilizator }) {
    const navigate = useNavigate();
    
    // --- State: Jobs & Offers ---
    const [activitati, setActivitati] = useState([]); // Recommended/Available jobs for the freelancer
    const [angajariFinalizate, setAngajariFinalizate] = useState([]); // Jobs successfully completed
    const [idActivitateSelectata, setIdActivitateSelectata] = useState(null); // The specific job the user is currently bidding on
    const [dateOferta, setDateOferta] = useState({ descriere: "", link: "", pret: "", durata: "" }); // Form data for a new bid

    // --- State: Certificate Management ---
    const [statusCertificat, setStatusCertificat] = useState({ stadiu: "se_incarca", esteValidat: false, idCertificat: null });
    const [afiseazaFormularCertificat, setAfiseazaFormularCertificat] = useState(false);
    const [modEditareCertificat, setModEditareCertificat] = useState(false); // Toggle between creating a new certificate or editing an existing one
    const [tipCertificat, setTipCertificat] = useState("");
    const [fisierSelectat, setFisierSelectat] = useState(null);
    const fileInputRef = useRef(null); // Direct reference to the file input to reset it properly

    // Load all dashboard data on mount
    useEffect(() => {
        incarcaActivitati();
        verificaStatusCertificat();
        incarcaAngajariFinalizate();
    }, []);

    // --- API Data Fetching ---

    // Fetches recommended activities (jobs) based on the freelancer's profile/category
    const incarcaActivitati = () => {
        fetch(`http://localhost:5129/api/Proiecte/recomandate`, {
            headers: GetAuthHeaders()
        }).then(res => res.json())
        .then(data => {
            if(Array.isArray(data)){
                setActivitati(data);
            }
        })
        .catch(err => console.error("Eroare:", err));
    };

    // Fetches jobs that the freelancer has completed and been paid for
    const incarcaAngajariFinalizate = async () => {
        try {
            const res = await fetch(`http://localhost:5129/api/Angajari/freelancer/finalizate`, {
                headers: GetAuthHeaders()
            });
            if(res.ok){
                const data = await res.json();
                setAngajariFinalizate(data);
            }
        }catch(err){
            console.error("Eroare la aducerea lucrărilor finalizate:", err);
        }
    }

    // Checks if the freelancer has uploaded a certificate and if a Legal Expert has approved it.
    // Bidding is locked until a valid certificate is on file.
    const verificaStatusCertificat = async () => {
        try {
            const res = await fetch(`http://localhost:5129/api/Certificat/status`, {
                headers: GetAuthHeaders()
            });
            if (res.status === 404) {
                setStatusCertificat({ stadiu: "lipseste", esteValidat: false, idCertificat: null });
            } else if (res.ok) {
                const data = await res.json();
                setStatusCertificat({
                    // Maps backend states to UI states
                    stadiu: data.esteValidat ? "validat" : (data.decizie?.toLowerCase() === "respins" ? "respins" : "in_asteptare"),
                    esteValidat: data.esteValidat,
                    idCertificat: data.idCertificat,
                    observatii: data.observatii // Feedback from the legal expert if rejected
                });
            }
        } catch (error) {
            console.error("Eroare la verificarea certificatului:", error);
            setStatusCertificat({ stadiu: "eroare", esteValidat: false, idCertificat: null });
        }
    };
    
    // --- Certificate Handlers ---

    // Prepares UI to upload a brand new certificate
    const deschideFormularCreareCertificat = () => {
        setModEditareCertificat(false);
        setTipCertificat("");
        setFisierSelectat(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Clear file input DOM element
        }
        setAfiseazaFormularCertificat(true);
    };

    // Prepares UI to overwrite an existing (waiting/rejected/approved) certificate
    const handlePregatesteEditareCertificat = () => {
        setModEditareCertificat(true);
        setTipCertificat("");
        setFisierSelectat(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        };
        setAfiseazaFormularCertificat(true);
    }

    const handleFisierSchimbat = (e) => {
        setFisierSelectat(e.target.files[0]);
    };

    // Uploads the certificate file via FormData. Uses PUT if editing, POST if new.
    const handleSalveazaCertificat = async (e) => {
        e.preventDefault();
        if (!fisierSelectat) {
            Swal.fire("Atenție", "Alege un fișier", "warning");
            return;
        }
        
        const url = modEditareCertificat ? `http://localhost:5129/api/Certificat/editeaza` : `http://localhost:5129/api/Certificat/adauga`;
        const metoda = modEditareCertificat ? "PUT" : "POST";
        
        const formData = new FormData();
        formData.append("Tip", tipCertificat);
        formData.append("Fisier", fisierSelectat);
        
        Swal.fire({ title: "Se salvează...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const response = await fetch(url, {
                method: metoda,
                // Do NOT manually set Content-Type here, let the browser define the multipart boundary
                headers: {"Authorization": `Bearer ${localStorage.getItem("token")}`},
                body: formData
            });
            if (response.ok) {
                Swal.fire("Succes.", modEditareCertificat ? "Certificatul a fost actualizat." : "Certificatul a fost trimis spre validare.", "success");
                setAfiseazaFormularCertificat(false);
                verificaStatusCertificat(); // Refresh status from backend
            } else {
                const errData = await response.json();
                Swal.fire("Eroare", errData.message || "A apărut o problemă la salvare.", "error");
            }
        } catch (error) {
            Swal.fire("Eroare de conexiune", "Nu ne-am putut conecta la server.", "error");
        }
    };

    // Deletes the freelancer's current certificate entirely
    const handleStergeCertificat = async () => {
        const rezultat = await Swal.fire({
            title: "Ești sigur ?",
            text: "Vrei să ștergi certificatul ?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Da, șterge",
            cancelButtonText: "Anulează"
        });
        if (!rezultat.isConfirmed){
            return;
        }
        try {
            const response = await fetch(`http://localhost:5129/api/Certificat/${statusCertificat.idCertificat}`, {
                method: "DELETE",
                headers: GetAuthHeaders()
            });
            if (response.ok) {
                Swal.fire("Șters", "Certificatul a fost șters cu succes.", "success");
                verificaStatusCertificat();
                setAfiseazaFormularCertificat(false);
            } else {
                Swal.fire("Eroare", "A apărut o eroare la ștergere.", "error");
            }
        } catch (error) {
            Swal.fire("Eroare de conexiune", "Nu am putut contacta serverul.", "error");
        }
    };

    // --- Offer (Bidding) Handlers ---

    // Opens the bidding inline form. Validates that the freelancer has an approved certificate first.
    const handleDeschideFormularOferta = (idActivitate) => {
        if (!statusCertificat.esteValidat) {
            Swal.fire({
                icon: "warning",
                title: "Atenție",
                text: "Nu poți aplica la proiecte până când certificatul tău nu este validat.",
            });
            return;
        }
        setIdActivitateSelectata(idActivitate);
        setDateOferta({descriere: "", link: "" , pret: "", durata: "" });
    };

    // Submits the bid (Offer) for a specific job/activity
    const handleTrimiteOferta = async (e) => {
        e.preventDefault();
        
        // Ensure the portfolio link is valid URL format
        if (!dateOferta.link || dateOferta.link.trim() === "") {
            Swal.fire({ icon: "warning", title: "Câmp obligatoriu", text: "Te rog introdu un link către portofoliul tău." })
            return;
        }
        const regexLink = /^(https?:\/\/)?([\w\-]+\.)+[a-z]{2,}(\/.*)?$/i;
        if (!regexLink.test(dateOferta.link.trim())) {
            Swal.fire({ icon: "error", title: "Link invalid", text: "Link-ul introdus nu este corect. Folosește un format valid(https://site.ro)" });
            return;
        }
        
        Swal.fire({ title: "Se trimite oferta...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const response = await fetch("http://localhost:5129/api/Oferte", {
                method: "POST",
                headers:{
                    ...GetAuthHeaders(),   
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    idActivitate: idActivitateSelectata,
                    descriere: dateOferta.descriere,
                    link: dateOferta.link,
                    pret: parseFloat(dateOferta.pret),
                    durata: parseInt(dateOferta.durata)
                })
            });
            
            if (response.ok) {
                Swal.fire("Succes.", "Ai aplicat cu succes la aceasta activitate.", "success");
                setIdActivitateSelectata(null); // Close the inline form
                setDateOferta({ titlu: "", descriere: "", link: "", pret: "", durata: "" }); // Reset form
                incarcaActivitati(); // Refresh activities to reflect changes (e.g. slots remaining)
            } else {
                const errData = await response.json();
                Swal.fire("Eroare", errData.message || "A apărut o problemă la trimiterea ofertei.", "error");
            }
        } catch (error) {
            Swal.fire("Eroare de conexiune", "Nu s-a putut conecta la server.", "error");
        }
    };

    return (
        <div className="panou-client-container">
            <h3 className="panou-client-titlu"> Panou Freelancer </h3>
            
            {/* --- SECTION 1: CERTIFICATE STATUS --- */}
            <div className="card-proiect">
                <h4 className="panou-sectiune-titlu"> Status Verificare Profil (Certificat) </h4>
                
                {statusCertificat.stadiu === "se_incarca" && <p> Se verifică statusul...</p>}
                
                {/* Condition: No Certificate Uploaded Yet */}
                {statusCertificat.stadiu === "lipseste" && !afiseazaFormularCertificat && (
                    <div>
                        <p> Contul tău nu este verificat. Nu poți aplica la joburi. </p>
                        <button className = "btn-trimite" onClick  ={deschideFormularCreareCertificat}> Încarcă un Certificat </button>
                    </div>
                )}

                {/* Condition: Certificate is Pending Expert Review */}
                {statusCertificat.stadiu === "in_asteptare" && !afiseazaFormularCertificat && (
                    <div>
                        <p> certificatul tău a fost trimis și așteaptă validarea unui expert legal. </p>
                        <button className= "btn-recenzie" onClick={handlePregatesteEditareCertificat}>
                            Editează Certificat
                        </button>
                        <button className= "btn-sterge-proiect" onClick={handleStergeCertificat}> Șterge Certificat  </button>
                    </div>
                )}

                {/* Condition: Certificate was Rejected */}
                {statusCertificat.stadiu === "respins" && !afiseazaFormularCertificat &&(
                    <div>
                        <p> <strong> Certificatul tău a fost respins.</strong></p>
                        {statusCertificat.observatii &&(
                            <p><strong>Motivul expertului: </strong> {statusCertificat.observatii}</p>
                        )}
                        <div className="butoane-finalizat">
                        <button className="btn-elibereaza" onClick={deschideFormularCreareCertificat}>
                            Încarcă un certificat nou
                        </button>
                        <button className="btn-sterge-proiect" onClick={handleStergeCertificat}>
                            Șterge certificat
                        </button>
                        </div>   
                    </div>
                )}

                {/* Condition: Certificate is Approved */}
                {statusCertificat.stadiu === "validat" && !afiseazaFormularCertificat && (
                    <div>
                        <p> Contul tău este verificat. Ai permisiunea de aplica la joburi. </p>
                        <button className= "btn-recenzie" onClick={handlePregatesteEditareCertificat}>
                            Editează Certificat
                        </button>
                        <button className= "btn-sterge-proiect" onClick={handleStergeCertificat}> Șterge Certificatul Actual </button>
                    </div>
                )}

                {/* Inline Form for Uploading/Editing Certificate */}
                {afiseazaFormularCertificat && (
                    <form onSubmit={handleSalveazaCertificat}>
                        <h5>{modEditareCertificat ? "Editează Datele Certificatului" : "Introdu Datele Noului Certificat"}</h5>
                        <div>
                            <label> Tip Document:<br /> 
                                <input type="text" required value={tipCertificat} onChange={(e) => setTipCertificat(e.target.value)} />
                            </label>
                        </div>
                        <div>
                            <label> Alege fișierul: <br />
                                <input type="file" ref={fileInputRef} onChange={handleFisierSchimbat} accept=".pdf, .jpg, .png, .jpeg" />
                            </label>
                        </div>
                        <div className="form-butoane">
                            <button className="btn-trimite" type="submit"> {modEditareCertificat ? "Salvează Modificările" : "Trimite spre Validare"} </button>
                            <button className= "btn-respinge-oferta" type="button" onClick={() => setAfiseazaFormularCertificat(false)}> Anulează </button>
                        </div>
                    </form>
                )}
            </div>

            {/* --- SECTION 2: ACTIVE PROJECTS (Imported Component) --- */}
            <div className="card-proiect">
                {/* ProiecteActive handles jobs the freelancer has successfully won and is working on */}
                <ProiecteActive idFreelancer={utilizator.id} />
            </div>

            {/* --- SECTION 3: COMPLETED JOBS --- */}
            <div className="card-proiect">
                <h4 className="panou-sectiune-titlu"> Lucrări finalizate ({angajariFinalizate.length})</h4>
                {angajariFinalizate.length === 0 ?(
                    <div className="sectiune-goala">
                        <p> Nu există lucrări finalizate.</p>
                    </div>
                ) : (
                    <ul className="lista-finalizate">
                        {angajariFinalizate.map((ang) =>(
                            <li className="card-finalizat" key={ang.idAngajare}>
                                <h4 className="card-titlu"> {ang.titlu}</h4>
                                <p><strong> Descriere:</strong>{ang.descriere}</p>
                                <p><strong>Data: </strong>{new Date(ang.dataAngajarii).toLocaleDateString('ro-RO')}</p>
                                <button className ="btn-recenzie" onClick={() => handleAdaugaRecenzie(ang.idAngajare, "Freelancer")}>
                                    Scrie o recenzie
                                </button>
                                <button className="btn-recenzie" onClick={() => navigate(`/profil-client/${ang.idClient}`)}>
                                    Vezi profil
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* --- SECTION 4: AVAILABLE JOBS / BIDDING --- */}
            <div>
                <div className="card-proiect">
                    <h4 className="panou-sectiune-titlu"> Joburi disponibile pentru tine:</h4>
                    {activitati && activitati.length > 0 ? (
                        <ul className="lista-proiecte">
                        {activitati.map((act) => (
                            <li className="card-proiect" key={act.idActivitate}>
                                <h4 className="card-titlu"> {act.titluActivitate}</h4>
                                <p> <strong> Proiect:</strong> {act.titluProiect}</p>
                                <p> <strong> Categorie:</strong> {act.categorie}</p>
                                <p> <strong> Descriere:</strong> {act.descriere}</p>
                                <p> <strong> Buget proiect:</strong>{act.buget} EUR </p>
                                <p> <strong> Locuri rămase: </strong> {act.nrMaximFreelanceri}</p>
                                <p> <strong> Similaritatea activității pentru tine: </strong> {(act.similaritate * 100).toFixed(1)}%</p>
                                
                                {/* Show link to requirements document if it exists */}
                                {act.fisierDocumentatie && (
                                    <p>
                                        <strong> Documentație atașată: </strong>
                                            <a href={`http://localhost:5129/Uploads/${act.fisierDocumentatie}`} target="_blank" rel="noreferrer">
                                                Vezi fișierul 
                                            </a>
                                    </p>
                                )}

                                {/* Ensure job is open before showing apply button/form */}
                                {act.nrMaximFreelanceri > 0 ?(
                                    idActivitateSelectata !== act.idActivitate ? (
                                        // Default Apply Button
                                        <button className="btn-elibereaza" onClick={() => handleDeschideFormularOferta(act.idActivitate)}> Aplică </button>
                                    ) : (
                                        // Inline form that appears when "Aplică" is clicked
                                        <form onSubmit={handleTrimiteOferta}>
                                            <h5> Completează oferta: </h5>
                                            <div>
                                                <label className="form-label"> 
                                                    Mesaj: <br />
                                                    <textarea className="form-textarea" required value={dateOferta.descriere} onChange={(e) => setDateOferta({...dateOferta, descriere: e.target.value})} /> 
                                                </label>
                                            </div>
                                            <label className="form-label">
                                                Link portofoliu: <br />
                                                <input className="form-input" type="text" value={dateOferta.link} onChange={(e) => setDateOferta({...dateOferta, link: e.target.value})} />
                                            </label>
                                            <div className="form-activitate-rand">
                                                <label className="form-label">
                                                    Preț ofertat (EUR): <br />
                                                    <input className="form-input" type="number" min="1" required value={dateOferta.pret} onChange={(e) => setDateOferta({...dateOferta, pret: e.target.value})} />
                                                </label>
                                                <label className="form-label">
                                                    Durata estimată (zile): <br />
                                                    <input className="form-input" type="number" min="1" required value={dateOferta.durata} onChange={(e) => setDateOferta({...dateOferta, durata: e.target.value})} />
                                                </label>
                                            </div>
                                            <div className="butoane-finalizat">
                                                <button className="btn-trimite" type="submit"> Trimite Oferta </button>
                                                <button className="btn-respinge-oferta" type="button" onClick={() => setIdActivitateSelectata(null)}> Anulează </button>
                                            </div>
                                        </form>
                                    )
                    ) : (
                        // Fallback if slots are full (this shouldn't render ideally if the backend filters them, but acts as a failsafe)
                        <p>Există deja un freelancer care se ocupa cu acest proiect.</p>
                    )}
                    </li>
                    ))}
                    </ul>
                    ) : (
                        <div className="sectiune-goala">
                            <p> Nu există activități disponibile.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}