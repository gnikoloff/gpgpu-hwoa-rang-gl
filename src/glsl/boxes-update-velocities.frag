uniform sampler2D positionsTexture;
uniform sampler2D velocitiesTexture;
uniform vec3 mousePos;
uniform vec2 textureDimensions;
uniform float delta;
uniform vec3 worldBounds;

void main () {
  float limit = SPEED_LIMIT;

  vec2 texCoords = gl_FragCoord.xy / textureDimensions;
  vec4 position = texture2D(positionsTexture, texCoords);
  vec4 velocity = texture2D(velocitiesTexture, texCoords);
  

  vec4 dir = vec4(mousePos.x * worldBounds.x, mousePos.y * worldBounds.y, mousePos.z * worldBounds.z, 0.0) - position;
  dir.z = 0.0;

  float dist = length(dir);
  float distSquared = dist * dist;

  float mouseRadius = 10.0;
  float mouseRadiusSquared = mouseRadius * mouseRadius;
  

  if (dist < mouseRadius) {
    float f = (distSquared / mouseRadiusSquared - 1.0) * delta * 20.0;
    velocity += normalize(dir) * f;
    limit += 5.0;
  }
  vec4 newPosition = position + velocity * delta * 15.0;

  if (newPosition.x > worldBounds.x * 0.5) {
    velocity.x *= -1.0;
  }
  if (newPosition.x < -worldBounds.x * 0.5) {
    velocity.x *= -1.0;
  }

  if (newPosition.y > worldBounds.y * 0.5) {
    velocity.y *= -1.0;
  }
  if (newPosition.y < -worldBounds.y * 0.5) {
    velocity.y *= -1.0;
  }

  if (newPosition.z > worldBounds.z * 0.5) {
    velocity.z *= -1.0;
  }
  if (newPosition.z < -worldBounds.z * 0.5) {
    velocity.z *= -1.0;
  }

  // Speed Limits
  if ( length( velocity ) > limit ) {
    velocity = normalize( velocity ) * limit;
  }
  gl_FragColor = velocity;
}
