import {useState, useEffect} from 'react';
import {useParams, useNavigate } from 'react-router-dom';
import '../CSS/Panou.css';
import { GetAuthHeaders } from '../TokenHeaders';

// Component that displays a Client's public profile to other users (e.g., Freelancers).
// It primarily shows the reviews and ratings the client has received from past jobs.
export default function ProfilClient(){
    // Extract the client's ID from the URL parameters (e.g., /profil-client/123)
    const{idClient} = useParams();
    const navigate = useNavigate();

    // --- State Management ---
    const [recenzii, setRecenzii] = useState([]); // List of individual reviews
    const [medie, setMedie] = useState(0); // Average rating score
    const [isLoading, setIsLoading] = useState(true); // Loading state for the initial data fetch

    // Fetch reviews whenever the component mounts or the client ID in the URL changes
    useEffect(() => {
        fetchRecenzii();
    }, [idClient]);

    // Fetches the client's reviews and calculated average from the backend
    const fetchRecenzii = async() => {
        try{
            const res = await fetch (`http://localhost:5129/api/Recenzie/client/${idClient}`, {
                headers: GetAuthHeaders()
            });
            if (res.ok){
                const data = await res.json();
                setRecenzii(data.recenzii);
                setMedie(data.medie);
            }   
        } catch (err){
            console.error("Eroare:", err);
        } finally {
            // Stop the loading spinner regardless of success or failure
            setIsLoading(false);
        }
    };

    // Helper function to generate visual star ratings (★ for filled, ☆ for empty)
    // Maps an array of 5 items, checking if the current index is less than or equal to the score
    const Stele = (nota) => {
        return [1,2,3,4,5].map(s => (
            <span key={s}>{s <= nota ? "★" : "☆"}</span>
        ));
    };

    // Display a loading indicator while fetching data
    if (isLoading){
        return <p> Se încarcă...</p>;
    }

    return (
        <div className="profil-container"> 
            {/* Go back to the previous page in browser history */}
            <button className="btn-inapoi" onClick={() => navigate(-1)}> Înapoi</button>
            <h2 className="profil-titlu"> Profil Client </h2>
            
            {/* Display overall average rating and total number of reviews */}
            <p> {Stele(Math.round(medie))} {medie > 0 ? `${medie} / 5` : "Nu există recenzii"}
                ({recenzii.length} {recenzii.length === 1 ? "recenzie" : "recenzii"})
            </p>
            
            {/* Conditionally render the list of reviews or a fallback message */}
            {recenzii.length === 0 ? (
                <p> Acest client nu are recenzii încă.</p>
            ) : (
                recenzii.map((r) => (
                    <div key={r.idRecenzie}>
                        {/* Individual review rating */}
                        <div>{Stele(r.nota)}</div>
                        {/* Optional review text */}
                        <p>{r.comentariu || "Fără comentariu."}</p>
                        {/* Formatted date of the review */}
                        <small>{new Date(r.data).toLocaleDateString('ro-RO')}</small>
                    </div>
                ))
            )}
        </div>
    );
}