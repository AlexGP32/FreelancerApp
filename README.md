# FreelancerApp

Aplicatie web de tip freelancing marketplace, unde clientii pot posta proiecte si angaja freelanceri, iar freelancerii pot aplica, lucra la proiecte si primi plata prin PayPal. Proiectul are frontend separat de backend: React pe partea de client si ASP.NET Core pe server, cu baza de date PostgreSQL.

## Despre proiect

Aplicatia are mai multe roluri de utilizator - client, freelancer, expert si admin - fiecare cu propriul panou. Un client poate posta un proiect, primi oferte de la freelanceri, angaja pe cineva si elibera plata dupa ce lucrarea e predata. Freelancerii pot aplica la proiecte, incarca documente/certificate pentru validare, si primesc recenzii dupa finalizarea lucrarilor. Exista si un sistem de dispute pentru cazurile in care client si freelancer nu cad de acord, plus generare de facturi in PDF pentru platile facute.

## Functionalitati principale

- Inregistrare si autentificare cu roluri multiple (client, freelancer, expert, admin), autentificare prin JWT
- Postare proiecte si activitati de catre clienti
- Oferte de la freelanceri, acceptate sau respinse de client
- Angajari, predare lucrare, eliberare plata, dispute
- Plati integrate cu PayPal
- Generare facturi PDF (QuestPDF)
- Certificate incarcate de freelanceri, validate de admin/expert
- Recenzii intre client si freelancer
- Recomandari de proiecte pe baza de embeddings (EmbeddingService)

## Tehnologii folosite

Backend:
- ASP.NET Core (.NET)
- Entity Framework Core
- PostgreSQL
- JWT pentru autentificare
- QuestPDF pentru generare facturi

Frontend:
- React 19
- Vite
- React Router
- SweetAlert2
- PayPal React SDK

## Structura proiectului

- `FreelancerApp.Client/` - aplicatia React (pagini in `src/Pagini`, stiluri in `src/CSS`)
- `FreelancerApp.Server/` - API-ul ASP.NET Core (`Controllers/`, `Models/`, `Uploads/` pentru fisiere incarcate)
- `Licenta.sql` - script SQL pentru popularea bazei de date
- `FreelancerApp.sln` - solutia Visual Studio care leaga client si server

## Cum rulezi proiectul

1. Creeaza o baza de date goala in PostgreSQL numita `Licenta`.
2. Ruleaza scriptul `Licenta.sql` pentru a popula baza cu datele necesare.
3. In `FreelancerApp.Server/appsettings.json` actualizeaza datele de conectare la baza, conturile paypal dar si cheia modelului API.
4. Porneste backend-ul:
   ```
   cd FreelancerApp.Server
   dotnet run
   ```
5. Porneste frontend-ul:
   ```
   cd FreelancerApp.Client
   npm install
   npm run dev
   ```
