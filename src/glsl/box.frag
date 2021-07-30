#if G_BUFFER_SUPPORTED == 1
  #extension GL_EXT_draw_buffers : require
#endif

uniform float fogDensity;
uniform int fallbackGBufferMode;

varying vec3 v_normal;
varying vec3 v_position;
varying vec3 v_positionFromCamera;

// #define LOG2 1.442695

void main () {
  vec3 normal = normalize(v_normal);

  #if G_BUFFER_SUPPORTED == 1
    gl_FragData[0] = vec4(v_position, 1.0);
    gl_FragData[1] = vec4(normal, 1.0);
    gl_FragData[2] = vec4(0.2, 0.2, 0.2, 1.0);
  #else
    if (fallbackGBufferMode == 0) {
      gl_FragColor = vec4(v_position, 1.0);
    } else if (fallbackGBufferMode == 1) {
      gl_FragColor = vec4(normal, 1.0);
    } else if (fallbackGBufferMode == 2) {
      gl_FragColor = vec4(0.2, 0.2, 0.2, 1.0);
    }
  #endif
}
