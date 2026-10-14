using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace FreelancerApp.Server.Services
{
    public class EmbeddingService
    {
        private static readonly HttpClient _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(120)
        };

        private readonly string _baseUrl;
        private readonly string _model;

        public EmbeddingService(IConfiguration configuration)
        {
            _baseUrl = configuration["Ollama:BaseUrl"] ?? "http://localhost:11434";
            _model = configuration["Ollama:Model"] ?? "bge-m3";
        }

        public async Task<float[]> GetEmbeddingAsync(string text)
        {
            var json = JsonSerializer.Serialize(new { model = _model, input = text });

            using var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/api/embed")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };

            HttpResponseMessage response;
            try
            {
                response = await _httpClient.SendAsync(request);
            }
            catch (HttpRequestException ex)
            {
                throw new Exception(
                    "Nu mă pot conecta la Ollama. Verifică dacă rulează (iconița din system tray sau 'ollama serve').", ex);
            }

            var responseString = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"Eroare Ollama ({(int)response.StatusCode}): {responseString}");
            }

            using var doc = JsonDocument.Parse(responseString);

            return doc.RootElement
                .GetProperty("embeddings")[0]
                .EnumerateArray()
                .Select(e => e.GetSingle())
                .ToArray();
        }
    }
}