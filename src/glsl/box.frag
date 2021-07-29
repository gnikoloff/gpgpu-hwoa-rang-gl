#if G_BUFFER_SUPPORTED == 1
  #extension GL_EXT_draw_buffers : require
#endif

uniform float fogDensity;
uniform int fallbackGBufferMode;

varying vec3 v_normal;
varying float v_rgb;
varying vec3 v_position;
varying vec3 v_positionFromCamera;

// #define LOG2 1.442695

void main () {
  vec3 normal = normalize(v_normal);
  // vec4 fogColor = vec4(0.4, 0.4, 0.4, 1.0);
  // float fogDistance = length(v_positionFromCamera);
  // float fogAmount = 1.0 - exp2(-fogDensity * fogDensity * fogDistance * fogDistance * LOG2);
  // fogAmount = clamp(fogAmount, 0.0, 1.0);

  // gl_FragColor = mix(vec4(normal, 1.0), fogColor, fogAmount);
  #if G_BUFFER_SUPPORTED == 1
    gl_FragData[0] = vec4(v_position, 0.0);
    gl_FragData[1] = vec4(normal, 0.0);
    gl_FragData[2] = vec4(vec3(v_rgb), 1.0);
  #else
    if (fallbackGBufferMode == 0) {
      gl_FragColor = vec4(v_position, 0.0);
    } else if (fallbackGBufferMode == 1) {
      gl_FragColor = vec4(normal, 0.0);
    } else if (fallbackGBufferMode == 2) {
      gl_FragColor = vec4(vec3(v_rgb), 1.0);
    }
  #endif
}
