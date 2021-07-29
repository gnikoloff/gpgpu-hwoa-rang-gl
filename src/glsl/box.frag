uniform float fogDensity;

varying vec3 v_normal;
varying vec3 v_position;

#define LOG2 1.442695

void main () {
  vec3 normal = normalize(v_normal);
  vec4 fogColor = vec4(0.4, 0.4, 0.4, 1.0);
  float fogDistance = length(v_position);
  float fogAmount = 1.0 - exp2(-fogDensity * fogDensity * fogDistance * fogDistance * LOG2);
  fogAmount = clamp(fogAmount, 0.0, 1.0);

  gl_FragColor = mix(vec4(normal, 1.0), fogColor, fogAmount);
}
