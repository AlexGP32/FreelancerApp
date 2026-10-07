import {useState, useEffect} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../CSS/Panou.css'
import { GetAuthHeaders } from '../TokenHeaders';

// Component that displays a Freelancer's public profile to other users (e.g., Clients).
// It fetches and displays the reviews and average rating the freelancer has received from past jobs.
export default function ProfilFreelancer(){
    // Extract the freelancer's ID from the URL parameters (e.g., /profil-freelancer/456)
    const{idFreelancer} = useParams();
    const navigate = useNavigate();

    // --- State Management ---
    const [recenzii, setRecenzii] = useState([]); // List of individual reviews
    const [medie, setMedie] = useState(0); // Average rating score calculated by the backend
    const [isLoading, setIsLoading] = useState(true); // Loading state for the initial data fetch

    // Fetch reviews whenever the component mounts or the freelancer ID in the URL changes
    useEffect(() => {
        fetchRecenzii();
    }, [idFreelancer]);

    // Fetches the freelancer's reviews and calculated average from the API
    const fetchRecenzii = async() => {
        try{
            const res = await fetch (`http://localhost:5129/api/Recenzie/freelancer/${idFreelancer}`, {
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
            // Stop the loading spinner regardless of fetch success or failure
            setIsLoading(false);
        }
    };

    // Helper function to generate visual star ratings (★ for filled, ☆ for empty)
    // Maps over an array of 5 items, checking if the current index is less than or equal to the score
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
        <div className="panou-client-container"> 
            {/* Go back to the previous page in browser history */}
            <button className="btn-inapoi" onClick={() => navigate(-1)}> Înapoi</button>
            
            <h2 className="panou-client-titlu"> Profil Freelancer </h2>
            
            {/* Display overall average rating and total number of reviews */}
            <div className="card-proiect">
                <p className="panou-sectiune-titlu">
                    {Stele(Math.round(medie))} {medie > 0 ? `${medie} / 5` : "Nu există recenzii"}
                    ({recenzii.length} {recenzii.length === 1 ? "recenzie" : "recenzii"})
                </p>
            </div>

            {/* Conditionally render the list of reviews or an empty state message */}
            {recenzii.length === 0 ? (
                <div className="sectiune-goala">
                    <p> Acest freelancer nu are recenzii încă.</p>
                </div>
            ) : (
                <ul className="lista-proiecte">
                    {recenzii.map((r) => (
                        <li className="card-proiect" key={r.idRecenzie}>
                            {/* Individual review rating */}
                            <div className="card-titlu">{Stele(r.nota)}</div>
                            
                            {/* Optional review text */}
                            <p>{r.comentariu || "Fără comentariu."}</p>
                            
                            {/* Formatted date of the review */}
                            <small className="data-recenzie">{new Date(r.data).toLocaleDateString('ro-RO')}</small>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}