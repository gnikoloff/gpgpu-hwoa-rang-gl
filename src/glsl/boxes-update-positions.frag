uniform sampler2D positionsTexture;
uniform sampler2D velocitiesTexture;
uniform vec2 textureDimensions;
uniform float delta;
uniform vec3 worldBounds;

void main () {
  vec2 texCoords = gl_FragCoord.xy / textureDimensions;
  vec4 position = texture2D(positionsTexture, texCoords);
  vec4 velocity = texture2D(velocitiesTexture, texCoords);

  vec4 newPosition = position + velocity * delta;

  if (newPosition.x > worldBounds.x * 0.5) {
    newPosition.x = worldBounds.x * 0.5;
  }
  if (newPosition.x < -worldBounds.x * 0.5) {
    newPosition.x = -worldBounds.x * 0.5;
  }

  if (newPosition.y > worldBounds.y * 0.5) {
    newPosition.y = worldBounds.y * 0.5;
  }
  if (newPosition.y < -worldBounds.y * 0.5) {
    newPosition.y = -worldBounds.y * 0.5;
  }

  if (newPosition.z > worldBounds.z * 0.5) {
    newPosition.z = worldBounds.y * 0.5;
  }
  if (newPosition.z < -worldBounds.z * 0.5) {
    newPosition.z = -worldBounds.y * 0.5;
  }

  gl_FragColor = newPosition;
  gl_FragColor.a = 1.0;
}
