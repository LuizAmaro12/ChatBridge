using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace ChatBridge;

public sealed record LoginRequest(string? Username, string? Password);

public sealed class AuthService(ChatOptions options)
{
    public static bool SecretEquals(string? supplied, string expected)
    {
        if (supplied is null) return false;
        return CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(supplied)),
            SHA256.HashData(Encoding.UTF8.GetBytes(expected)));
    }

    public object? Login(LoginRequest login)
    {
        if (login.Username != options.Username || !SecretEquals(login.Password, options.Password))
            return null;
        var expires = DateTime.UtcNow.AddSeconds(options.TokenSeconds);
        var token = new JwtSecurityToken(options.Issuer, options.Audience,
            [new Claim(JwtRegisteredClaimNames.Sub, options.Username),
             new Claim("name", options.DisplayName)],
            DateTime.UtcNow, expires,
            new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.SigningKey)),
                SecurityAlgorithms.HmacSha256));
        return new { accessToken = new JwtSecurityTokenHandler().WriteToken(token),
            expiresAt = expires, user = new { id = options.Username, name = options.DisplayName } };
    }

    public TokenValidationParameters Validation => new()
    {
        ValidateIssuer = true, ValidIssuer = options.Issuer,
        ValidateAudience = true, ValidAudience = options.Audience,
        ValidateLifetime = true, RequireExpirationTime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.SigningKey)),
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        ClockSkew = TimeSpan.FromSeconds(30)
    };
}
