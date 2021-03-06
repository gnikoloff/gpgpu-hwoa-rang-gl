uniform float time;

attribute vec4 position;
attribute float id;
attribute mat4 instanceModelMatrix;
attribute vec3 normal;

uniform sampler2D positionsTexture;
uniform sampler2D velocitiesTexture;
uniform vec2 textureDimensions;

varying vec3 v_normal;
varying vec3 v_position;
varying vec3 v_positionFromCamera;

vec4 getValFromTextureArray (sampler2D texture, vec2 dimensions, float index) {
  float y = floor(index / dimensions.x);
  float x = mod(index, dimensions.x);
  vec2 texCoords = (vec2(x, y) + 0.5) / dimensions;
  return texture2D(texture, texCoords);
}

mat3 rotation3dX(float angle) {
  float s = sin(angle);
  float c = cos(angle);

  return mat3(
    1.0, 0.0, 0.0,
    0.0, c, s,
    0.0, -s, c
  );
}

mat3 rotation3dY(float angle) {
  float s = sin(angle);
  float c = cos(angle);

  return mat3(
    c, 0.0, -s,
    0.0, 1.0, 0.0,
    s, 0.0, c
  );
}

mat3 rotation3dZ(float angle) {
  float s = sin(angle);
  float c = cos(angle);

  return mat3(
    c, s, 0.0,
    -s, c, 0.0,
    0.0, 0.0, 1.0
  );
}

void main () {
  vec4 velocity = getValFromTextureArray(velocitiesTexture, textureDimensions, id);      

  mat3 rotation3d = rotation3dX(velocity.x * 0.1) * rotation3dY(velocity.y * 0.1) * rotation3dZ(velocity.z * 0.1);

  vec3 offsetPosition = rotation3d *
                        position.xyz +
                        getValFromTextureArray(positionsTexture, textureDimensions, id).rgb;

  vec4 worldPosition = instanceModelMatrix *
                       modelMatrix *
                       vec4(offsetPosition, 1.0);

  gl_Position = projectionMatrix *
                viewMatrix *
                worldPosition;

  v_normal = rotation3d * normal;
  v_position = worldPosition.xyz;
  v_positionFromCamera = -(viewMatrix * vec4(offsetPosition, 1.0)).xyz;
}
