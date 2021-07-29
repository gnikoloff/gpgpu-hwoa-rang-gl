uniform sampler2D sampler;
varying vec2 v_uv;

#ifdef IS_DEPTH_TEXTURE
  const float near_plane = 0.1;
  const float far_plane = 100.0;

  float LinearizeDepth(float depth) {
    float z = depth * 2.0 - 1.0; // Back to NDC 
    return (2.0 * NEAR_PLANE * FAR_PLANE) / (FAR_PLANE + NEAR_PLANE - z * (FAR_PLANE - NEAR_PLANE));
  }
#endif

void main () {
  #ifdef IS_DEPTH_TEXTURE
    float depthValue = texture2D(sampler, v_uv).r;
    float debugDepth = LinearizeDepth(depthValue) / FAR_PLANE;
    gl_FragColor = vec4(vec3(debugDepth), 1.0);
  #else
    gl_FragColor = texture2D(sampler, v_uv);
  #endif
}
