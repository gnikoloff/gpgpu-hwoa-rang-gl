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

import BASE_VERTEX_SHADER from './glsl/base-vertex.vert'
import BOXES_UPDATE_VELOCITIES_FRAGMENT_SHADER from './glsl/boxes-update-velocities.frag'
import BOXES_UPDATE_POSITIONS_FRAGMENT_SHADER from './glsl/boxes-update-positions.frag'
import BOX_VERTEX_SHADER from './glsl/box.vert'
import BOX_FRAGMENT_SHADER from './glsl/box.frag'
import PLANE_DEBUG_FRAGMENT_SHADER from './glsl/debug-plane.frag'

const UPDATE_VELOCITIES_PROGRAM_NAME = 'updateVelocities'
const UPDATE_POSITIONS_PROGRAM_NAME = 'updatePositions'

const VELOCITIES_TEXTURE_1_NAME = 'velocitiesTexture1'
const VELOCITIES_TEXTURE_2_NAME = 'velocitiesTexture2'

const POSITIONS_TEXTURE_1_NAME = 'positionsTexture1'
const POSITIONS_TEXTURE_2_NAME = 'positionsTexture2'

const PARTICLE_TEXTURE_WIDTH = 128
const PARTICLE_TEXTURE_HEIGHT = 128
const PARTICLE_COUNT = PARTICLE_TEXTURE_WIDTH * PARTICLE_TEXTURE_HEIGHT

const OPTIONS = {
  BOUNDS_X: 20,
  BOUNDS_Y: 20,
  BOUNDS_Z: 80,
}

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
perspCamera.setPosition({ x: 0, y: 0, z: 48 })
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

new CameraController(perspCamera)

const swapRenderer = new SwapRenderer(gl)

const ids = new Array(PARTICLE_COUNT).fill(0).map((_, i) => i)
const positions = ids
  .map(() => [
    (Math.random() * 2 - 1) * 10,
    (Math.random() * 2 - 1) * 10,
    (Math.random() * 2 - 1) * 80,
    0,
  ])
  .flat()
const typedPositions = Framebuffer.supportRenderingToFloat(gl)
  ? new Float32Array(positions)
  : new Uint8Array(positions)
const velocities = ids
  .map(() => [
    (Math.random() * 2 - 1) * 10,
    Math.random() * 0.01,
    Math.random() * 20,
    1,
  ])
  // .map(() => [0, 0, 0])
  .flat()
const typedVelocities = Framebuffer.supportRenderingToFloat(gl)
  ? new Float32Array(velocities)
  : new Uint8Array(velocities)

swapRenderer
  .createProgram(
    UPDATE_VELOCITIES_PROGRAM_NAME,
    BASE_VERTEX_SHADER,
    BOXES_UPDATE_VELOCITIES_FRAGMENT_SHADER,
    {
      SPEED_LIMIT: '4.0',
      BOUNDS_X: `${OPTIONS.BOUNDS_X}.0`,
      BOUNDS_Y: `${OPTIONS.BOUNDS_Y}.0`,
      BOUNDS_Z: `${OPTIONS.BOUNDS_Z}.0`,
    },
  )
  .createProgram(
    UPDATE_POSITIONS_PROGRAM_NAME,
    BASE_VERTEX_SHADER,
    BOXES_UPDATE_POSITIONS_FRAGMENT_SHADER,
    {
      BOUNDS_Z: `${OPTIONS.BOUNDS_Z}.0`,
    },
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
      fogDensity: { type: UNIFORM_TYPE_FLOAT, value: 0.02 },
    },
    vertexShaderSource: BOX_VERTEX_SHADER,
    fragmentShaderSource: BOX_FRAGMENT_SHADER,
  })
}

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
    fragmentShaderSource: PLANE_DEBUG_FRAGMENT_SHADER,
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
    fragmentShaderSource: PLANE_DEBUG_FRAGMENT_SHADER,
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

  // mousePos[2] = Math.sin(ts * 0.2) * 20

  swapRenderer
    .setSize(PARTICLE_TEXTURE_WIDTH, PARTICLE_TEXTURE_HEIGHT)
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

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
  gl.clearColor(0.4, 0.4, 0.4, 1.0)
  gl.enable(gl.DEPTH_TEST)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

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
