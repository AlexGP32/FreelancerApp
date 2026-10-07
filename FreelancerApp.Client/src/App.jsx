import { BrowserRouter, Routes, Route, Navigate }
  from 'react-router-dom';
import Inregistrare from './Pagini/Inregistrare';
import Autentificare from './Pagini/Autentificare';
import Panou from './Pagini/Panou';
import SetariCont from './Pagini/SetariCont';
import SchimbareRol from './Pagini/SchimbareRol';
import CreareCertificat from './Pagini/CreareCertificat';
import EditareCertificat from './Pagini/EditareCertificat';
import ProfilFreelancer from './Pagini/ProfilFreelancer';
import ProfilClient from './Pagini/ProfilClient';

function RutaProtejata({children}){
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to = "/autentificare" />;
}
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inregistrare />} />
        <Route path="/inregistrare" element={<Inregistrare />} />
        <Route path="/autentificare" element={<Autentificare />} />
        <Route path="/panou" element={<RutaProtejata> <Panou/> </RutaProtejata>} />
        <Route path="/setaricont" element={<RutaProtejata> <SetariCont /> </RutaProtejata>} />
        <Route path="/schimbarerol" element={<RutaProtejata> <SchimbareRol /></RutaProtejata>} />
        <Route path="/creare-certificat" element={<RutaProtejata> <CreareCertificat /></RutaProtejata> } />
        <Route path="/editare-certificat" element={<RutaProtejata><EditareCertificat />  </RutaProtejata>} />
        <Route path="/profil-freelancer/:idFreelancer" element={<RutaProtejata> <ProfilFreelancer /> </RutaProtejata>} />
        <Route path="/profil-client/:idClient" element={<RutaProtejata> <ProfilClient />  </RutaProtejata>} />
      </Routes>
    </BrowserRouter>
  )
}
