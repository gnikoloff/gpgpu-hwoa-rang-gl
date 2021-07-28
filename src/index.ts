import { toHalf } from './helpers'
import './index.css'

import {
  Geometry,
  PerspectiveCamera,
  Mesh,
  CameraController,
  SwapRenderer,
  UNIFORM_TYPE_FLOAT,
  UNIFORM_TYPE_INT,
  UNIFORM_TYPE_VEC2,
  OrthographicCamera,
  GeometryUtils,
  UNIFORM_TYPE_VEC3,
  InstancedMesh,
  Framebuffer,
} from './lib/hwoa-rang-gl'

const BASE_VERTEX_SHADER = `
  attribute vec4 position;

  #ifdef INCLUDE_UVS
    attribute vec2 uv;

    varying vec2 v_uv;
  #endif

  void main () {
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * position;

    // gl_PointSize = 10.0;

    #ifdef INCLUDE_UVS
      v_uv = uv;
    #endif
  }
`

const UPDATE_VELOCITIES_PROGRAM_NAME = 'updateVelocities'
const UPDATE_POSITIONS_PROGRAM_NAME = 'updatePositions'

const VELOCITIES_TEXTURE_1_NAME = 'velocitiesTexture1'
const VELOCITIES_TEXTURE_2_NAME = 'velocitiesTexture2'

const POSITIONS_TEXTURE_1_NAME = 'positionsTexture1'
const POSITIONS_TEXTURE_2_NAME = 'positionsTexture2'

const PARTICLE_TEXTURE_WIDTH = 128
const PARTICLE_TEXTURE_HEIGHT = 128
const PARTICLE_COUNT = PARTICLE_TEXTURE_WIDTH * PARTICLE_TEXTURE_HEIGHT

const canvas = document.createElement('canvas')

document.body.appendChild(canvas)
canvas.width = innerWidth * devicePixelRatio
canvas.height = innerHeight * devicePixelRatio
canvas.style.setProperty('width', `${innerWidth}px`)
canvas.style.setProperty('height', `${innerHeight}px`)

const gl = canvas.getContext('webgl')

const mousePos = [0, 0, 0]

let oldTime = 0

const perspCamera = new PerspectiveCamera(
  (45 * Math.PI) / 180,
  innerWidth / innerHeight,
  0.1,
  100,
)
perspCamera.setPosition({ x: 0, y: 10, z: 10 })
perspCamera.lookAt([0, 0, 0])

const orthoCamera = new OrthographicCamera(
  -innerWidth / 2,
  innerWidth / 2,
  innerHeight / 2,
  -innerHeight / 2,
  0.1,
  10,
)
orthoCamera.setPosition({ x: 0, y: 0, z: 1 })
orthoCamera.lookAt([0, 0, 0])

const cameraControl = new CameraController(perspCamera)

const swapRenderer = new SwapRenderer(gl)

const ids = new Array(PARTICLE_COUNT).fill(0).map((_, i) => i)
const positions = ids
  .map(() => [
    (Math.random() * 2 - 1) * 10,
    (Math.random() * 2 - 1) * 10,
    (Math.random() * 2 - 1) * 10,
    0,
  ])
  .flat()
const typedPositions = Framebuffer.supportRenderingToFloat(gl)
  ? new Float32Array(positions)
  : new Uint16Array(positions.map(toHalf))
const velocities = ids
  .map(() => [
    (Math.random() * 2 - 1) * 10,
    Math.random() * 0.01,
    Math.random() * 1,
    1,
  ])
  // .map(() => [0, 0, 0])
  .flat()
const typedVelocities = Framebuffer.supportRenderingToFloat(gl)
  ? new Float32Array(velocities)
  : new Uint16Array(velocities.map(toHalf))

// console.log(velocities)

swapRenderer
  .createProgram(
    UPDATE_VELOCITIES_PROGRAM_NAME,
    BASE_VERTEX_SHADER,
    `
  uniform sampler2D positionsTexture;
  uniform sampler2D velocitiesTexture;
  uniform vec3 mousePos;
  uniform vec2 textureDimensions;
  uniform float delta;

  const float BOUNDS_X = 40.0;
  const float BOUNDS_Y = 40.0;
  const float BOUNDS_Z = 40.0;

  const float SPEED_LIMIT = 4.0;

  void main () {
    float limit = SPEED_LIMIT;

    vec2 texCoords = gl_FragCoord.xy / textureDimensions;
    vec4 position = texture2D(positionsTexture, texCoords);
    vec4 velocity = texture2D(velocitiesTexture, texCoords);
    

    vec4 dir = vec4(mousePos.x * BOUNDS_X, mousePos.y * BOUNDS_Y, 0.0, 0.0) - position;
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

    if (newPosition.x > BOUNDS_X * 0.5) {
      velocity.x *= -1.0;
    }
    if (newPosition.x < -BOUNDS_X * 0.5) {
      velocity.x *= -1.0;
    }

    if (newPosition.y > BOUNDS_Y * 0.5) {
      velocity.y *= -1.0;
    }
    if (newPosition.y < -BOUNDS_Y * 0.5) {
      velocity.y *= -1.0;
    }

    if (newPosition.z > BOUNDS_Z * 0.5) {
      velocity.z *= -1.0;
    }
    if (newPosition.z < -BOUNDS_Z * 0.5) {
      velocity.z *= -1.0;
    }

    // Speed Limits
    if ( length( velocity ) > limit ) {
      velocity = normalize( velocity ) * limit;
    }
    gl_FragColor = velocity;
    // gl_FragColor.a = 1.0;
  }
`,
  )
  .createProgram(
    UPDATE_POSITIONS_PROGRAM_NAME,
    BASE_VERTEX_SHADER,
    `
      uniform sampler2D positionsTexture;
      uniform sampler2D velocitiesTexture;
      uniform vec2 textureDimensions;
      uniform float delta;

      void main () {
        vec2 texCoords = gl_FragCoord.xy / textureDimensions;
        vec4 position = texture2D(positionsTexture, texCoords);
        vec4 velocity = texture2D(velocitiesTexture, texCoords);

        vec4 newPosition = position + velocity * delta;
        gl_FragColor = newPosition;
        gl_FragColor.a = 1.0;
      }
  `,
  )

  // Positions

  .createTexture(
    POSITIONS_TEXTURE_1_NAME,
    PARTICLE_TEXTURE_WIDTH,
    PARTICLE_TEXTURE_HEIGHT,
    // @ts-ignore
    typedPositions,
  )
  .createFramebuffer(
    POSITIONS_TEXTURE_1_NAME,
    PARTICLE_TEXTURE_WIDTH,
    PARTICLE_TEXTURE_HEIGHT,
  )
  .createTexture(
    POSITIONS_TEXTURE_2_NAME,
    PARTICLE_TEXTURE_WIDTH,
    PARTICLE_TEXTURE_HEIGHT,
  )
  .createFramebuffer(
    POSITIONS_TEXTURE_2_NAME,
    PARTICLE_TEXTURE_WIDTH,
    PARTICLE_TEXTURE_HEIGHT,
  )

  // Velocities
  .createTexture(
    VELOCITIES_TEXTURE_1_NAME,
    PARTICLE_TEXTURE_WIDTH,
    PARTICLE_TEXTURE_HEIGHT,
    // @ts-ignore
    typedVelocities,
  )
  .createFramebuffer(
    VELOCITIES_TEXTURE_1_NAME,
    PARTICLE_TEXTURE_WIDTH,
    PARTICLE_TEXTURE_HEIGHT,
  )
  .createTexture(
    VELOCITIES_TEXTURE_2_NAME,
    PARTICLE_TEXTURE_WIDTH,
    PARTICLE_TEXTURE_HEIGHT,
  )
  .createFramebuffer(
    VELOCITIES_TEXTURE_2_NAME,
    PARTICLE_TEXTURE_WIDTH,
    PARTICLE_TEXTURE_HEIGHT,
  )

  .useProgram(UPDATE_POSITIONS_PROGRAM_NAME)
  // @ts-ignore
  .setUniform('positionsTexture', UNIFORM_TYPE_INT, 0)
  // @ts-ignore
  .setUniform('velocitiesTexture', UNIFORM_TYPE_INT, 1)
  // @ts-ignore
  .setUniform('textureDimensions', UNIFORM_TYPE_VEC2, [
    PARTICLE_TEXTURE_WIDTH,
    PARTICLE_TEXTURE_HEIGHT,
  ])

  .useProgram(UPDATE_VELOCITIES_PROGRAM_NAME)
  // @ts-ignore
  .setUniform('mousePos', UNIFORM_TYPE_VEC3, mousePos)
  // @ts-ignore
  .setUniform('positionsTexture', UNIFORM_TYPE_INT, 0)
  // @ts-ignore
  .setUniform('velocitiesTexture', UNIFORM_TYPE_INT, 1)
  // @ts-ignore
  .setUniform('textureDimensions', UNIFORM_TYPE_VEC2, [
    PARTICLE_TEXTURE_WIDTH,
    PARTICLE_TEXTURE_HEIGHT,
  ])

// const ids = new Float32Array(PARTICLE_COUNT)
// for (let i = 0; i < PARTICLE_COUNT; i++) {
//   ids[i] = 0
// }

let triangleMesh
{
  const radius = 0.5
  const { vertices, uv, normal, indices } = GeometryUtils.createBox({
    width: radius,
    height: radius,
    depth: radius,
  })
  const geo = new Geometry(gl)
    .addIndex({ typedArray: indices })
    .addAttribute('position', { typedArray: vertices, size: 3 })
    .addAttribute('normal', { typedArray: normal, size: 3 })
    .addAttribute('id', {
      typedArray: new Float32Array(ids),
      size: 1,
      instancedDivisor: 1,
    })
  triangleMesh = new InstancedMesh(gl, {
    geometry: geo,
    instanceCount: PARTICLE_COUNT,
    defines: {},
    uniforms: {
      time: { type: UNIFORM_TYPE_FLOAT, value: 0 },
      positionsTexture: { type: UNIFORM_TYPE_INT, value: 0 },
      velocitiesTexture: { type: UNIFORM_TYPE_INT, value: 1 },
      textureDimensions: {
        type: UNIFORM_TYPE_VEC2,
        value: [PARTICLE_TEXTURE_WIDTH, PARTICLE_TEXTURE_HEIGHT],
      },
    },
    vertexShaderSource: `
    uniform float time;

    attribute vec4 position;
    attribute float id;
    attribute mat4 instanceModelMatrix;
    attribute vec3 normal;

    uniform sampler2D positionsTexture;
    uniform sampler2D velocitiesTexture;
    uniform vec2 textureDimensions;

    varying vec3 v_normal;

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

      mat3 rotation3d = rotation3dX(velocity.x) * rotation3dY(velocity.y) * rotation3dZ(velocity.z);

      vec3 offsetPosition = rotation3d *
                            position.xyz +
                            getValFromTextureArray(positionsTexture, textureDimensions, id).rgb;

      gl_Position = projectionMatrix *
                    viewMatrix *
                    instanceModelMatrix *
                    modelMatrix *
                    vec4(offsetPosition, 1.0);

      v_normal = rotation3d * normal;
    }
  `,
    fragmentShaderSource: `
      varying vec3 v_normal;
      void main () {
        vec3 normal = normalize(v_normal);
        gl_FragColor = vec4(normal, 1.0);
      }
  `,
  })
}
// mesh.drawMode = gl.POINTS

let debugPositionsMesh
{
  const width = PARTICLE_TEXTURE_WIDTH
  const height = PARTICLE_TEXTURE_HEIGHT
  const { vertices, uv, indices } = GeometryUtils.createPlane({
    width,
    height,
  })
  const geometry = new Geometry(gl)
    .addAttribute('position', { typedArray: vertices, size: 3 })
    .addAttribute('uv', { typedArray: uv, size: 2 })
    .addIndex({ typedArray: indices })
  debugPositionsMesh = new Mesh(gl, {
    geometry,
    uniforms: {
      sampler: { type: UNIFORM_TYPE_INT, value: 0 },
    },
    defines: {
      INCLUDE_UVS: 1,
    },
    vertexShaderSource: BASE_VERTEX_SHADER,
    fragmentShaderSource: `
      uniform sampler2D sampler;
      varying vec2 v_uv;

      void main () {
        gl_FragColor = texture2D(sampler, v_uv);
      }
    `,
  }).setPosition({
    x: -innerWidth / 2 + width / 2,
    y: -innerHeight / 2 + height / 2,
  })
}

let debugVelocitiesMesh
{
  const width = PARTICLE_TEXTURE_WIDTH
  const height = PARTICLE_TEXTURE_HEIGHT
  const { vertices, uv, indices } = GeometryUtils.createPlane({
    width,
    height,
  })
  const geometry = new Geometry(gl)
    .addAttribute('position', { typedArray: vertices, size: 3 })
    .addAttribute('uv', { typedArray: uv, size: 2 })
    .addIndex({ typedArray: indices })
  debugVelocitiesMesh = new Mesh(gl, {
    geometry,
    uniforms: {
      sampler: { type: UNIFORM_TYPE_INT, value: 0 },
    },
    defines: {
      INCLUDE_UVS: 1,
    },
    vertexShaderSource: BASE_VERTEX_SHADER,
    fragmentShaderSource: `
      uniform sampler2D sampler;
      varying vec2 v_uv;

      void main () {
        gl_FragColor = texture2D(sampler, v_uv);
      }
    `,
  }).setPosition({
    x: -innerWidth / 2 + width / 2 + width,
    y: -innerHeight / 2 + height / 2,
  })
}

document.body.addEventListener('mousemove', (e) => {
  mousePos[0] = (e.pageX - innerWidth / 2) / innerWidth
  mousePos[1] = -(e.pageY - innerHeight / 2) / innerHeight
})
requestAnimationFrame(drawFrame)
document.body.addEventListener('touchmove', (e) => e.preventDefault())

function drawFrame(ts) {
  ts /= 1000
  const dt = ts - oldTime
  oldTime = ts

  requestAnimationFrame(drawFrame)

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
  gl.clearColor(0.4, 0.4, 0.4, 1.0)
  gl.enable(gl.DEPTH_TEST)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  // mousePos[2] = Math.sin(ts * 0.2) * 20

  swapRenderer
    .useProgram(UPDATE_VELOCITIES_PROGRAM_NAME)
    // @ts-ignore
    .setUniform('mousePos', UNIFORM_TYPE_VEC3, mousePos)
    // @ts-ignore
    .setUniform('delta', UNIFORM_TYPE_FLOAT, dt)
    .run(
      [POSITIONS_TEXTURE_1_NAME, VELOCITIES_TEXTURE_1_NAME],
      VELOCITIES_TEXTURE_2_NAME,
    )
    .swap(VELOCITIES_TEXTURE_1_NAME, VELOCITIES_TEXTURE_2_NAME)

    .useProgram(UPDATE_POSITIONS_PROGRAM_NAME)
    // @ts-ignore
    .setUniform('delta', UNIFORM_TYPE_FLOAT, dt)
    .run(
      [POSITIONS_TEXTURE_1_NAME, VELOCITIES_TEXTURE_1_NAME],
      POSITIONS_TEXTURE_2_NAME,
    )
    .swap(POSITIONS_TEXTURE_1_NAME, POSITIONS_TEXTURE_2_NAME)

  // boxMesh.use().setCamera(perspCamera).draw()

  // gl.enable(gl.CULL_FACE)
  // gl.cullFace(gl.CCW)
  // gl.cullFace(gl.FRONT_AND_BACK)

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE)

  gl.activeTexture(gl.TEXTURE0)
  swapRenderer.getTexture(POSITIONS_TEXTURE_1_NAME).bind()
  gl.activeTexture(gl.TEXTURE1)
  swapRenderer.getTexture(VELOCITIES_TEXTURE_1_NAME).bind()
  triangleMesh
    .use()
    .setUniform('time', UNIFORM_TYPE_FLOAT, ts)
    .setCamera(perspCamera)
    .draw()

  gl.disable(gl.BLEND)

  gl.activeTexture(gl.TEXTURE0)
  swapRenderer.getTexture(POSITIONS_TEXTURE_1_NAME).bind()
  debugPositionsMesh.use().setCamera(orthoCamera).draw()

  gl.activeTexture(gl.TEXTURE0)
  swapRenderer.getTexture(VELOCITIES_TEXTURE_1_NAME).bind()
  debugVelocitiesMesh.use().setCamera(orthoCamera).draw()
}
