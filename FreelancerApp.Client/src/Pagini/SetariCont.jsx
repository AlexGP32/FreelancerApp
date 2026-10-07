import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { useNavigate } from 'react-router-dom'
import '../CSS/Inregistrare-Logare.css'
import { GetAuthHeaders } from '../TokenHeaders'

// Component for updating the user's profile settings (Account Settings).
// Pre-fills the form with existing data and handles validation for role-specific updates.
export default function SetariCont() {
    const navigate = useNavigate()
    
    // --- State Management ---
    const [rol, setRol] = useState('') // The user's current role
    
    // Common profile fields
    const [email, setEmail] = useState('')
    const [nume, setNume] = useState('')
    const [parola, setParola] = useState('') // Optional: Only filled if the user wants to change their password
    const [confirmaParola, setConfirmaParola] = useState('')
    const [telefon, setTelefon] = useState('')
    const [judet, setJudet] = useState('')
    const [oras, setOras] = useState('')
    const [strada, setStrada] = useState('')
    const [numar, setNumar] = useState('')
    
    // Role-specific fields
    const [cnpCui, setCnpCui] = useState('') // Client
    const [iban, setIban] = useState('') // Freelancer
    const [profesie, setProfesie] = useState('') // Freelancer
    const [departament, setDepartament] = useState('') // ExpertLegal
    const [codLegitimatie, setCodLegitimatie] = useState('') // ExpertLegal

    // Fetch existing profile data when the component mounts to pre-fill the form
    useEffect(() => {
        const userSalvat = localStorage.getItem('utilizatorLogat')
        if (userSalvat) {
            const user = JSON.parse(userSalvat)
            setRol(user.rol)
            setNume(user.nume)
            setEmail(user.email)

            // Fetch full profile details from the backend
            fetch(`http://localhost:5129/api/Utilizator/profil-curent`, {
                headers: GetAuthHeaders(),
            })
                .then((res) => res.json())
                .then((dateAduse) => {
                    // Populate common fields
                    setEmail(dateAduse.email || '')
                    setTelefon(dateAduse.telefon || '')
                    setJudet(dateAduse.judet || '')
                    setOras(dateAduse.oras || '')
                    setStrada(dateAduse.strada || '')
                    setNumar(dateAduse.numar || '')

                    // Populate role-specific fields dynamically
                    if (user.rol === 'Client') {
                        setCnpCui(dateAduse.cnpCui || '')
                    }
                    if (user.rol === 'Freelancer') {
                        setIban(dateAduse.iban || '')
                        setProfesie(dateAduse.profesie || '')
                    }
                    if (user.rol === 'ExpertLegal') {
                        setDepartament(dateAduse.departament || '')
                        setCodLegitimatie(dateAduse.codLegitimatie || '')
                    }
                })
                .catch((err) =>
                    console.error('Eroare la preluarea profilului:', err)
                )
        } else {
            navigate('/autentificare')
        }
    }, [navigate])

    // Comprehensive form validation (similar to the Registration component)
    const valideazaFormular = () => {
        // 1. Empty field checks for common fields
        if (!judet || !oras || !strada || !numar || !email || !telefon) {
            return 'Toate câmpurile trebuie să fie completate !'
        }
        
        // 2. Name validation
        const numeRegex = /^[a-zA-ZăâîșțĂÂÎȘȚ\s-]+$/
        if (!numeRegex.test(nume)) {
            return 'Nume invalid! Folosește doar litere.'
        }
        if (nume.length < 3) {
            return 'Numele trebuie să conțină minim 3 caractere.'
        }
        
        // 3. Email & Phone validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return "Email invalid ! Formatul adecvat este 'nume@domeniu.com'"
        }
        const telefonRegex = /^07\d{8}$/
        if (!telefonRegex.test(telefon)) {
            return "Telefon invalid ! Trebuie sa inceapă cu prefixul '07' și să aibe lungimea de 10 cifre."
        }

        // 4. Password validation (Only checked if the user actually typed something in the password field)
        if (parola) {
            const parolaRegex = /^(?=.*[a-zA-Z])(?=.*\d).{6,}$/
            if (!parolaRegex.test(parola)) {
                return 'Parola trebuie să aibă un minim de 6 caractere, conținând cel puțin o literă și o cifră.'
            }
            if (parola !== confirmaParola) {
                return 'Parolele nu coincid.'
            }
        }

        // 5. Role-Specific Validations
        if (rol === 'Client') {
            const valoare = cnpCui.trim().toUpperCase()
            
            // Modulo 11 validation for Romanian CNP
            const validareCNP = (cnpText) => {
                if (cnpText.length !== 13 || !/^[1-9]\d{12}$/.test(cnpText)) {
                    return false
                }
                const coeficienti = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9]
                let suma = 0
                for (let i = 0; i < 12; i++) {
                    suma += parseInt(cnpText.charAt(i)) * coeficienti[i]
                }
                let rest = suma % 11
                let cifraControlCalculata = rest === 10 ? 1 : rest
                let cifraControlReala = parseInt(cnpText.charAt(12))
                return cifraControlCalculata === cifraControlReala
            }
            
            // Modulo 11 validation for Romanian CUI
            const validareCUI = (cuiText) => {
                let curatat = cuiText.replace(/^RO/i, '')
                if (!/^\d{2,10}$/.test(curatat)) {
                    return false
                }
                const coeficientiCUI = [7, 5, 3, 2, 1, 7, 5, 3, 2]
                let cifraControlReala = parseInt(
                    curatat.charAt(curatat.length - 1)
                )
                let numarFaraControl = curatat.substring(0, curatat.length - 1)
                let suma = 0
                let j = coeficientiCUI.length - 1
                for (let i = numarFaraControl.length - 1; i >= 0; i--) {
                    suma +=
                        parseInt(numarFaraControl.charAt(i)) * coeficientiCUI[j]
                    j--
                }
                let rest = (suma * 10) % 11
                let cifraControlCalculata = rest === 10 ? 0 : rest
                return cifraControlCalculata === cifraControlReala
            }
            
            if (!validareCNP(valoare) && !validareCUI(valoare)) {
                return 'CUI-ul sau CNP-ul introdus este invalid (cifra de control nu corespunde).'
            }
        }

        if (rol === 'Freelancer') {
            // Modulo 97 validation for IBAN
            const validareIBAN = (ibanText) => {
                let iban = ibanText.replace(/\s+/g, '').toUpperCase()
                if (!/^RO\d{2}[A-Z0-9]{20}$/.test(iban)) {
                    return false
                }
                let rearanjat = iban.substring(4) + iban.substring(0, 4)
                let numericIban = ''
                for (let i = 0; i < rearanjat.length; i++) {
                    let charCode = rearanjat.charCodeAt(i)
                    if (charCode >= 65 && charCode <= 90) {
                        numericIban += (charCode - 55).toString()
                    } else {
                        numericIban += rearanjat.charAt(i)
                    }
                }
                let rest = BigInt(numericIban) % 97n
                return rest === 1n
            }
            if (!validareIBAN(iban)) {
                return 'Codul IBAN introdus nu este valid matematic.'
            }
            const profesieRegex = /^[a-zA-ZăâîșțĂÂÎȘȚ\s-]+$/
            if (!profesieRegex.test(profesie)) {
                return 'Profesie invalidă. Folosește doar litere.'
            }
        }
        
        if (rol === 'ExpertLegal') {
            if (departament.trim().length < 3) {
                return 'Denumirea departamentului este prea scurtă.'
            }
            if (codLegitimatie.length < 4 || codLegitimatie.length > 15) {
                return 'Codul legitimației trebuie să aibă între 4 și 15 caractere.'
            }
            const codRegex = /^[a-zA-Z0-9-]+$/
            if (!codRegex.test(codLegitimatie)) {
                return 'Codul legitimației poate conține doar litere, cifre și cratimă. '
            }
        }
        return null // Validation passed
    }

    // Handles the form submission to update the user's data
    const handleSubmit = async (e) => {
        e.preventDefault()
        
        // Check for validation errors before hitting the API
        const eroare = valideazaFormular()
        if (eroare) {
            Swal.fire({
                icon: 'error',
                title: 'Eroare',
                text: eroare,
                confirmButtonColor: 'red',
            })
            return
        }
        
        // Build base payload
        let dateUtilizator = {
            nume,
            email,
            telefon,
            judet,
            oras,
            strada,
            numar,
        }

        // Only include password in the update if the user actually typed a new one
        if (parola) {
            dateUtilizator.parola = parola
        }

        // Add role-specific data to the payload
        if (rol === 'Client') {
            dateUtilizator = { ...dateUtilizator, cnpCui: cnpCui.toUpperCase() }
        } else if (rol === 'Freelancer') {
            dateUtilizator = {
                ...dateUtilizator,
                iban: iban.replace(/\s/g, '').toUpperCase(),
                profesie,
            }
        } else if (rol === 'ExpertLegal') {
            dateUtilizator = {
                ...dateUtilizator,
                departament,
                codLegitimatie: codLegitimatie.toUpperCase(),
            }
        }

        const linkApi = 'http://localhost:5129/api/Utilizator/actualizare-date'
        try {
            const raspuns = await fetch(linkApi, {
                method: 'PUT',
                headers: {
                    ...GetAuthHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dateUtilizator),
            })

            if (raspuns.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Succes !',
                    text: 'Datele au fost actualizate cu succes!',
                })
                
                // Update local storage with the new name and email so the UI (like headers) reflects changes immediately
                const userLocal = JSON.parse(localStorage.getItem('utilizatorLogat'))
                localStorage.setItem(
                    'utilizatorLogat',
                    JSON.stringify({ ...userLocal, nume: nume, email: email })
                )
                navigate('/panou')
            } else {
                const textEroare = await raspuns.text()
                Swal.fire({
                    icon: 'error',
                    title: 'Eroare Server',
                    text: textEroare,
                })
            }
        } catch (err) {
            console.error(err)
            Swal.fire({
                icon: 'warning',
                title: 'Problemă',
                text: 'Eroare la trimiterea datelor către server.',
            })
        }
    }

    return (
        <div className="register-container">
            <form className="register-form" onSubmit={handleSubmit} noValidate>
                <h2> Actualizare Date </h2>
                <div>
                    Editare profil pentru rolul de: <strong> {rol} </strong>
                </div>

                {/* --- Common Fields --- */}
                <label>
                    <span>
                        Județ: <span className="required"> * </span>
                    </span>
                    <input
                        type="text"
                        value={judet || ''}
                        onChange={(e) => setJudet(e.target.value)}
                        placeholder="Introduceți județul"
                    />
                </label>
                <label>
                    {' '}
                    <span>
                        Oraș: <span className="required"> * </span>
                    </span>
                    <input
                        type="text"
                        value={oras || ''}
                        onChange={(e) => setOras(e.target.value)}
                        placeholder="Introduceți orașul"
                    />
                </label>

                <label>
                    <span>
                        Stradă : <span className="required"> * </span>
                    </span>
                    <input
                        type="text"
                        value={strada || ''}
                        onChange={(e) => setStrada(e.target.value)}
                        placeholder="Introduceți strada"
                    />
                </label>
                <label>
                    {' '}
                    <span>
                        Număr: <span className="required"> * </span>
                    </span>
                    <input
                        type="text"
                        value={numar || ''}
                        onChange={(e) => setNumar(e.target.value)}
                        placeholder="Introduceți numărul"
                    />
                </label>
                <label>
                    <span>
                        {' '}
                        Nume: <span className="required"> * </span>
                    </span>
                    <input
                        type="text"
                        value={nume || ''}
                        onChange={(e) => setNume(e.target.value)}
                        placeholder="Popescu"
                    />
                </label>
                <label>
                    <span>
                        {' '}
                        Email: <span className="required"> * </span>
                    </span>
                    <input
                        type="email"
                        value={email || ''}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="exemplu@email.com"
                    />
                </label>
                <label>
                    <span>Parola:</span>
                    <input
                        type="password"
                        value={parola || ''}
                        onChange={(e) => setParola(e.target.value)}
                        placeholder="******"
                    />
                </label>
                <label>
                    <span>Confirmă Parola:</span>
                    <input
                        type="password"
                        value={confirmaParola || ''}
                        onChange={(e) => setConfirmaParola(e.target.value)}
                        placeholder="******"
                    />
                </label>
                <label>
                    <span>
                        Telefon: <span className="required"> * </span>
                    </span>
                    <input
                        type="tel"
                        value={telefon || ''}
                        onChange={(e) => setTelefon(e.target.value)}
                        placeholder="0712345678"
                    />
                </label>

                {/* --- Conditional Role Fields --- */}
                {rol === 'Client' && (
                    <label>
                        <span>
                            CNP/CUI <span className="required"> * </span>
                            <span
                                className="info-icon"
                                title="Codul unic de înregistrare pentru firme sau pentru persoane fizice."
                            >
                                {' '}
                                ⓘ{' '}
                            </span>
                        </span>
                        <input
                            type="text"
                            value={cnpCui || ''}
                            onChange={(e) => setCnpCui(e.target.value)}
                            placeholder="2990219469000 (CNP)/14399840 (CUI)"
                        />
                    </label>
                )}

                {rol === 'Freelancer' && (
                    <>
                        <label>
                            <span>
                                Profesie : <span className="required"> * </span>
                            </span>
                            <input
                                type="text"
                                value={profesie || ''}
                                onChange={(e) => setProfesie(e.target.value)}
                                placeholder="Ex: Programator Web, Designer..."
                            />
                        </label>
                        <label>
                            <span>
                                IBAN : <span className="required"> * </span>
                                <span
                                    className="info-icon"
                                    title="Contul bancar unde vei primi plățile pentru proiectele finalizate."
                                >
                                    {' '}
                                    ⓘ{' '}
                                </span>
                            </span>
                            <input
                                type="text"
                                value={iban || ''}
                                onChange={(e) => setIban(e.target.value)}
                                placeholder="RO49AAAA1B31007593840000"
                            />
                        </label>
                    </>
                )}

                {rol === 'ExpertLegal' && (
                    <>
                        <label>
                            <span>
                                Departament:{' '}
                                <span className="required"> * </span>
                            </span>
                            <input
                                type="text"
                                value={departament || ''}
                                onChange={(e) => setDepartament(e.target.value)}
                                placeholder="LEG-1234"
                            />
                        </label>
                        <label>
                            <span>
                                Cod Legitimație:{' '}
                                <span className="required"> * </span>
                            </span>
                            <input
                                type="text"
                                value={codLegitimatie || ''}
                                onChange={(e) =>
                                    setCodLegitimatie(e.target.value)
                                }
                                placeholder="B-12345"
                            />
                        </label>
                    </>
                )}

                <div className="schimbare-butoane">
                    <button type="button" onClick={() => navigate('/panou')}>
                        {' '}
                        Înapoi la Panou{' '}
                    </button>
                    <button type="submit"> Salvează Modificările </button>
                </div>
            </form>
        </div>
    )
}