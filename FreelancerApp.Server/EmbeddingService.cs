using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace FreelancerApp.Server.Services
{
    public class EmbeddingService
    {
        private readonly string _apiKey;
        private static readonly HttpClient _httpClient = new HttpClient();

        public EmbeddingService(IConfiguration configuration)
        {
            _apiKey = configuration["HuggingFace:ApiKey"];
        }

        public async Task<float[]> GetEmbeddingAsync(string text)
        {
            var requestBody = new { inputs = text };
            var json = JsonSerializer.Serialize(requestBody);
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                "https://router.huggingface.co/hf-inference/models/ibm-granite/granite-embedding-97m-multilingual-r2/pipeline/feature-extraction")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

            var response = await _httpClient.SendAsync(request);
            var responseString = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"Eroare API HuggingFace ({(int)response.StatusCode}): {responseString}");
            }

            var doc = JsonDocument.Parse(responseString);
            var root = doc.RootElement;

            float[] embeddingArray;

            if (root.ValueKind == JsonValueKind.Array &&
                root.EnumerateArray().First().ValueKind == JsonValueKind.Number)
            {
                embeddingArray = root
                    .EnumerateArray()
                    .Select(e => e.GetSingle())
                    .ToArray();
            }
            else if (root.ValueKind == JsonValueKind.Array &&
                     root.EnumerateArray().First().ValueKind == JsonValueKind.Array)
            {
                embeddingArray = root
                    .EnumerateArray()
                    .First()
                    .EnumerateArray()
                    .Select(e => e.GetSingle())
                    .ToArray();
            }
            else
            {
                throw new Exception($"Format necunoscut de embedding: {root.ValueKind}");
            }

            return embeddingArray;
        }
    }
}