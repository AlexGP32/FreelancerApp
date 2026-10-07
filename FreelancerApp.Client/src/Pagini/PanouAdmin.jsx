import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { GetAuthHeaders } from '../TokenHeaders'

// Admin dashboard component for managing platform users.
// Allows the admin to view all users, delete accounts entirely, or remove specific roles.
export default function PanouAdmin({ utilizator }) {
    const [utilizatori, setUtilizatori] = useState([]) // State to store the list of users

    // Fetches the complete list of users from the backend
    const incarcaUtilizatori = async () => {
        try {
            const res = await fetch(
                'http://localhost:5129/api/Utilizator/toti',
                {
                    headers: GetAuthHeaders(), // Includes the JWT token for authorization
                }
            )
            if (res.ok) {
                const data = await res.json()
                setUtilizatori(data)
            }
        } catch (error) {
            console.error('Eroare la încărcarea utilizatorilor:', error)
        }
    }

    // Trigger the fetch operation when the component first mounts
    useEffect(() => {
        incarcaUtilizatori()
    }, [])

    // Handles the complete deletion of a user account
    const handleStergeUtilizator = async (id, nume) => {
        // Ask for confirmation before performing a destructive action
        const result = await Swal.fire({
            title: `Ștergi utilizatorul ${nume}?`,
            text: 'Această acțiune este ireversabilă!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'green',
            cancelButtonColor: 'red',
            confirmButtonText: 'Da, șterge!',
            cancelButtonText: 'Anulează',
        })
        if (!result.isConfirmed) {
            return
        }
        try {
            const response = await fetch(
                `http://localhost:5129/api/Utilizator/sterge/${id}`,
                {
                    method: 'DELETE',
                    headers: GetAuthHeaders(),
                }
            )
            if (response.ok) {
                Swal.fire(
                    'Șters.',
                    'Utilizatorul a fost șters cu succes.',
                    'success'
                )
                // Update the UI immediately by filtering out the deleted user to avoid an extra API call
                setUtilizatori(utilizatori.filter((u) => u.idUser !== id))
            } else {
                const errorText = await response.text()
                Swal.fire('Eroare', errorText, 'error')
            }
        } catch (error) {
            Swal.fire('Eroare', 'Nu s-a putut conecta la server.', 'error')
        }
    }

    // Handles the removal of a specific role from a user (e.g., revoking 'Freelancer' access)
    const handleStergeRol = async (id, nume, rol) => {
        const result = await Swal.fire({
            title: `Ștergi rolul ${rol} al lui ${nume}?`,
            text: 'Această actiune este ireversibilă.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'green',
            cancelButtonColor: 'red',
            confirmButtonText: 'Șterge',
            cancelButtonText: 'Anulează',
        })
        if (!result.isConfirmed) {
            return
        }
        try {
            const response = await fetch(
                `http://localhost:5129/api/Utilizator/sterge-rol/${id}/${rol}`,
                {
                    method: 'DELETE',
                    headers: GetAuthHeaders(),
                }
            )
            if (response.ok) {
                Swal.fire('Șters.', `Rolul ${rol} a fost șters.`, 'success')
                // Refetch the users to ensure the UI reflects the updated roles accurately
                incarcaUtilizatori()
            } else {
                const errorText = await response.text()
                Swal.fire('Eroare', errorText, 'error')
            }
        } catch (error) {
            Swal.fire('Eroare', 'Nu s-a putut conecta la server.', 'error')
        }
    }

    return (
        <div className="panou-client-container">
            <div className="card-proiect">
                <h3 className="panou-client-titlu"> Panoul Adminului </h3>
                <p>
                    Aici vei putea gestiona toți utilizatorii de pe platformă.
                </p>
                <div>
                    {utilizatori && utilizatori.length > 0 ? (
                        <ul className="lista-proiecte">
                            {utilizatori.map((u) => (
                                <li className="card-proiect" key={u.idUser}>
                                    <h4 className="card-titlu">{u.nume}</h4>
                                    <p>
                                        <strong> ID: </strong> {u.idUser}
                                    </p>
                                    <p>
                                        <strong> Roluri:</strong>{' '}
                                        {u.roluri || 'Fără rol'}
                                    </p>
                                    <p>
                                        <strong> Email: </strong> {u.email}
                                    </p>
                                    <p>
                                        <strong> Telefon: </strong>{' '}
                                        {u.telefon || 'Nespecificat'}
                                    </p>
                                    <div className="form-butoane">
                                        <button
                                            className="btn-sterge-proiect"
                                            onClick={() =>
                                                handleStergeUtilizator(
                                                    u.idUser,
                                                    u.nume
                                                )
                                            }
                                        >
                                            Șterge utilizator
                                        </button>

                                        {/* Render a delete button for each role the user has, EXCEPT the Admin role.
                                            This prevents administrators from accidentally demoting themselves or other admins. */}
                                        {u.roluri &&
                                            u.roluri
                                                .split(', ')
                                                .filter((r) => r !== 'Admin')
                                                .map((rol) => (
                                                    <button
                                                        className="btn-respinge-oferta"
                                                        key={rol}
                                                        onClick={() =>
                                                            handleStergeRol(
                                                                u.idUser,
                                                                u.nume,
                                                                rol
                                                            )
                                                        }
                                                    >
                                                        Șterge rol {rol}
                                                    </button>
                                                ))}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="sectiune-goala">
                            <p> Momentan nu există utilizatori.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}