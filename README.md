# FreelancerApp

![FreelancerApp demo](demo.gif)

A freelancing marketplace web app where clients can post projects and hire freelancers, and freelancers can apply, work on projects and get paid through PayPal. The frontend and backend are separate: React on the client side, ASP.NET Core on the server, with a PostgreSQL database.

## About

The app supports several user roles (client, freelancer, expert and admin), each with its own dashboard. A client can post a project, receive offers from freelancers, hire someone and release the payment once the work is delivered. Freelancers can apply to projects, upload documents/certificates for validation, and receive reviews after finishing a job. There is also a dispute system for cases where the client and the freelancer disagree, plus PDF invoice generation for completed payments.

## Key Features

- Registration and login with multiple roles (client, freelancer, expert, admin), using JWT authentication
- Clients can post projects and tasks
- Freelancers send offers, which the client can accept or reject
- Hiring, work delivery, payment release and disputes
- Integrated PayPal payments
- PDF invoice generation (QuestPDF)
- Certificates uploaded by freelancers and validated by an admin/expert
- Reviews between client and freelancer
- Embedding-based project recommendations (EmbeddingService)

## Tech Stack

**Backend**

- ASP.NET Core (.NET)
- Entity Framework Core
- PostgreSQL
- JWT authentication
- QuestPDF for invoice generation

**Frontend**

- React 19
- Vite
- React Router
- SweetAlert2
- PayPal React SDK

## Project Structure

- `FreelancerApp.Client/` - React app (pages in `src/Pagini`, styles in `src/CSS`)
- `FreelancerApp.Server/` - ASP.NET Core API (`Controllers/`, `Models/`, `Uploads/` for uploaded files)
- `Licenta.sql` - SQL script that populates the database
- `FreelancerApp.sln` - Visual Studio solution linking the client and the server

## Getting Started

1. Create an empty PostgreSQL database named `Licenta`.
2. Run the `Licenta.sql` script to populate it with the required data.
3. In `FreelancerApp.Server/appsettings.json`, update the database connection string, the PayPal credentials and the API key for the embedding model.
4. Start the backend:

```
   cd FreelancerApp.Server
   dotnet run
```

5. Start the frontend:

```
   cd FreelancerApp.Client
   npm install
   npm run dev
```
