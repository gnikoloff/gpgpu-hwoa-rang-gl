precision highp float;

uniform vec2 resolution;
uniform sampler2D positionTexture;
uniform sampler2D normalTexture;
uniform sampler2D colorTexture;
uniform vec3 lightDirection;
uniform float lightFactor;

void main () {
  vec2 fragCoord = gl_FragCoord.xy / resolution;

  vec3 normal = normalize(texture2D(normalTexture, fragCoord).xyz);
  vec4 color = texture2D(colorTexture, fragCoord);

  float light = dot(normal, lightDirection);
  gl_FragColor = color * light * lightFactor;
}
