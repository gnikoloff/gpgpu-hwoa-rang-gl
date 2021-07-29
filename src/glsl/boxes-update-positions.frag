uniform sampler2D positionsTexture;
uniform sampler2D velocitiesTexture;
uniform vec2 textureDimensions;
uniform float delta;

void main () {
  vec2 texCoords = gl_FragCoord.xy / textureDimensions;
  vec4 position = texture2D(positionsTexture, texCoords);
  vec4 velocity = texture2D(velocitiesTexture, texCoords);

  vec4 newPosition = position + velocity * delta;
  if (newPosition.z > BOUNDS_Z) {
    newPosition.z = -BOUNDS_Z;
  }
  gl_FragColor = newPosition;
  gl_FragColor.a = 1.0;
}
