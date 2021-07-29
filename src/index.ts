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
  Texture,
  Framebuffer,
  getExtension,
} from './lib/hwoa-rang-gl'

import BASE_VERTEX_SHADER from './glsl/base-vertex.vert'
import BOXES_UPDATE_VELOCITIES_FRAGMENT_SHADER from './glsl/boxes-update-velocities.frag'
import BOXES_UPDATE_POSITIONS_FRAGMENT_SHADER from './glsl/boxes-update-positions.frag'
import BOX_VERTEX_SHADER from './glsl/box.vert'
import BOX_FRAGMENT_SHADER from './glsl/box.frag'
import POINT_LIGHT_FRAGMENT_SHADER from './glsl/point-lighting.frag'
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
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 100,
}

const pointLightMeshes = []
const pointLightPositions = []
const pointLightRadiuses = []

let oldTime = 0

let debugGPGPUPositionsMesh
let debugGPGPUVelocitiesMesh
let debugBoxesPositionsMesh
let debugBoxesNormalsMesh
let debugBoxesColorsMesh
let debugBoxesDepthMesh

let boxesMesh

const canvas = document.createElement('canvas')

document.body.appendChild(canvas)
canvas.width = innerWidth * devicePixelRatio
canvas.height = innerHeight * devicePixelRatio
canvas.style.setProperty('width', `${innerWidth}px`)
canvas.style.setProperty('height', `${innerHeight}px`)

const gl = canvas.getContext('webgl')

const mousePos = [0, 0, 0]

const perspCamera = new PerspectiveCamera(
  (45 * Math.PI) / 180,
  innerWidth / innerHeight,
  OPTIONS.CAMERA_NEAR,
  OPTIONS.CAMERA_FAR,
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

const drawBuffersExtension = getExtension(gl, 'WEBGL_draw_buffers')
const halfFloatTexExtension = getExtension(gl, 'OES_texture_half_float')
const depthTextureExtension = getExtension(gl, 'WEBGL_depth_texture')

const gBuffer = gl.createFramebuffer()
gl.bindFramebuffer(gl.FRAMEBUFFER, gBuffer)

const texturePosition = new Texture(gl, {
  type: Framebuffer.supportRenderingToFloat(gl)
    ? gl.FLOAT
    : halfFloatTexExtension.HALF_FLOAT_OES,
  format: gl.RGB,
  minFilter: gl.NEAREST,
  magFilter: gl.NEAREST,
})
  .bind()
  .fromSize(innerWidth * devicePixelRatio, innerHeight * devicePixelRatio)

gl.framebufferTexture2D(
  gl.FRAMEBUFFER,
  drawBuffersExtension.COLOR_ATTACHMENT0_WEBGL,
  gl.TEXTURE_2D,
  texturePosition.getTexture(),
  0,
)

const textureNormal = new Texture(gl, {
  type: Framebuffer.supportRenderingToFloat(gl)
    ? gl.FLOAT
    : halfFloatTexExtension.HALF_FLOAT_OES,
  format: gl.RGB,
  minFilter: gl.NEAREST,
  magFilter: gl.NEAREST,
})
  .bind()
  .fromSize(innerWidth * devicePixelRatio, innerHeight * devicePixelRatio)

gl.framebufferTexture2D(
  gl.FRAMEBUFFER,
  drawBuffersExtension.COLOR_ATTACHMENT1_WEBGL,
  gl.TEXTURE_2D,
  textureNormal.getTexture(),
  0,
)

const textureColor = new Texture(gl, {
  type: Framebuffer.supportRenderingToFloat(gl)
    ? gl.FLOAT
    : halfFloatTexExtension.HALF_FLOAT_OES,
  format: gl.RGB,
  minFilter: gl.NEAREST,
  magFilter: gl.NEAREST,
})
  .bind()
  .fromSize(innerWidth, innerHeight)

gl.framebufferTexture2D(
  gl.FRAMEBUFFER,
  drawBuffersExtension.COLOR_ATTACHMENT2_WEBGL,
  gl.TEXTURE_2D,
  textureColor.getTexture(),
  0,
)

const depthTexture = new Texture(gl, {
  minFilter: gl.LINEAR,
  magFilter: gl.LINEAR,
  type: gl.UNSIGNED_SHORT,
  format: gl.DEPTH_COMPONENT,
})
  .bind()
  .setIsFlip(0)
  .fromSize(innerWidth, innerHeight)

gl.framebufferTexture2D(
  gl.FRAMEBUFFER,
  gl.DEPTH_ATTACHMENT,
  gl.TEXTURE_2D,
  depthTexture.getTexture(),
  0,
)

if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
  console.log('cant use gBuffer!')
}

drawBuffersExtension.drawBuffersWEBGL([
  drawBuffersExtension.COLOR_ATTACHMENT0_WEBGL, // gl_FragData[0]
  drawBuffersExtension.COLOR_ATTACHMENT1_WEBGL, // gl_FragData[1]
  drawBuffersExtension.COLOR_ATTACHMENT2_WEBGL, // gl_FragData[2]
])
gl.bindFramebuffer(gl.FRAMEBUFFER, null)

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
  boxesMesh = new InstancedMesh(gl, {
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

{
  const { vertices, indices } = GeometryUtils.createSphere({
    widthSegments: 30,
    heightSegments: 30,
  })
  const geometry = new Geometry(gl)
    .addIndex({ typedArray: indices })
    .addAttribute('position', { typedArray: vertices, size: 3 })
  const sharedUniforms = {
    positionTexture: { type: UNIFORM_TYPE_INT, value: 0 },
    normalTexture: { type: UNIFORM_TYPE_INT, value: 1 },
    colorTexture: { type: UNIFORM_TYPE_INT, value: 2 },
    resolution: {
      type: UNIFORM_TYPE_VEC2,
      value: [innerWidth, innerHeight],
    },
  }

  for (let i = 0; i < 5; i++) {
    const radius = 10 + Math.random() * 20
    const position = [
      (Math.random() * 2 - 1) * OPTIONS.BOUNDS_X * 0.5,
      (Math.random() * 2 - 1) * OPTIONS.BOUNDS_Y * 0.5,
      ((Math.random() * 2 - 1) * OPTIONS.BOUNDS_Z) / 2,
    ]
    const color = [Math.random(), Math.random(), Math.random()]
    const mesh = new Mesh(gl, {
      geometry,
      uniforms: {
        ...sharedUniforms,
        'PointLight.shininessSpecularRadius': {
          type: UNIFORM_TYPE_VEC3,
          value: [44, 0.3, radius],
        },
        'PointLight.position': {
          type: UNIFORM_TYPE_VEC3,
          value: position,
        },
        'PointLight.color': {
          type: UNIFORM_TYPE_VEC3,
          value: color,
        },
      },
      vertexShaderSource: BASE_VERTEX_SHADER,
      fragmentShaderSource: POINT_LIGHT_FRAGMENT_SHADER,
    })
    mesh
      .setPosition({ x: position[0], y: position[1], z: position[2] })
      .setScale({ x: radius, y: radius, z: radius })
    pointLightPositions.push(position)
    pointLightMeshes.push(mesh)
    pointLightRadiuses.push(radius)
  }
}

{
  const debugMeshHeightReference = PARTICLE_TEXTURE_HEIGHT
  const debugMeshHeightDelta = debugMeshHeightReference / innerHeight

  const gpgpuDebugWidth = PARTICLE_TEXTURE_WIDTH
  const gpgpguDebugHeight = PARTICLE_TEXTURE_HEIGHT

  const gBufferDebugWidth = innerWidth * debugMeshHeightDelta
  const gBufferDebugHeight = innerHeight * debugMeshHeightDelta

  let debugMeshAccumulatedX = 0

  debugGPGPUPositionsMesh = createDebugPlane(
    gpgpuDebugWidth,
    gpgpguDebugHeight,
    -innerWidth / 2,
    -innerHeight / 2,
  )
  debugMeshAccumulatedX += gpgpuDebugWidth
  debugGPGPUVelocitiesMesh = createDebugPlane(
    gpgpuDebugWidth,
    gpgpguDebugHeight,
    -innerWidth / 2 + debugMeshAccumulatedX,
    -innerHeight / 2,
  )
  debugMeshAccumulatedX += gpgpuDebugWidth
  debugBoxesPositionsMesh = createDebugPlane(
    gBufferDebugWidth,
    gBufferDebugHeight,
    -innerWidth / 2 + debugMeshAccumulatedX,
    -innerHeight / 2,
  )
  debugMeshAccumulatedX += gBufferDebugWidth

  debugBoxesNormalsMesh = createDebugPlane(
    gBufferDebugWidth,
    gBufferDebugHeight,
    -innerWidth / 2 + debugMeshAccumulatedX,
    -innerHeight / 2,
  )
  debugMeshAccumulatedX += gBufferDebugWidth

  debugBoxesColorsMesh = createDebugPlane(
    gBufferDebugWidth,
    gBufferDebugHeight,
    -innerWidth / 2 + debugMeshAccumulatedX,
    -innerHeight / 2,
  )
  debugMeshAccumulatedX += gBufferDebugWidth

  debugBoxesDepthMesh = createDebugPlane(
    gBufferDebugWidth,
    gBufferDebugHeight,
    -innerWidth / 2 + debugMeshAccumulatedX,
    -innerHeight / 2,
    {
      IS_DEPTH_TEXTURE: 1,
      NEAR_PLANE: OPTIONS.CAMERA_NEAR,
      FAR_PLANE: `${OPTIONS.CAMERA_FAR}.0`,
    },
  )
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

  gl.disable(gl.BLEND)

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

  gl.blendFunc(gl.ONE, gl.ONE)
  gl.depthFunc(gl.LEQUAL)

  gl.bindFramebuffer(gl.FRAMEBUFFER, gBuffer)
  {
    gl.depthMask(true)
    gl.enable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    gl.activeTexture(gl.TEXTURE0)
    swapRenderer.getTexture(POSITIONS_TEXTURE_1_NAME).bind()
    gl.activeTexture(gl.TEXTURE1)
    swapRenderer.getTexture(VELOCITIES_TEXTURE_1_NAME).bind()
    boxesMesh
      .use()
      .setUniform('time', UNIFORM_TYPE_FLOAT, ts)
      .setCamera(perspCamera)
      .draw()
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  gl.depthMask(false)
  gl.disable(gl.DEPTH_TEST)
  gl.enable(gl.BLEND)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  gl.activeTexture(gl.TEXTURE0)
  texturePosition.bind()
  gl.activeTexture(gl.TEXTURE1)
  textureNormal.bind()
  gl.activeTexture(gl.TEXTURE2)
  textureColor.bind()

  pointLightMeshes.forEach((mesh, i) => {
    const position = pointLightPositions[i]
    const radius = pointLightRadiuses[i]
    position[2] += dt * 4
    if (position[2] > OPTIONS.BOUNDS_Z / 2 + radius) {
      position[2] = -OPTIONS.BOUNDS_Z / 2
    }
    mesh
      .use()
      .setPosition({ z: pointLightPositions[i][2] })
      .setUniform(
        'PointLight.position',
        UNIFORM_TYPE_VEC3,
        pointLightPositions[i],
      )
      .setCamera(perspCamera)
      .draw()
  })

  gl.disable(gl.BLEND)

  gl.activeTexture(gl.TEXTURE0)
  swapRenderer.getTexture(POSITIONS_TEXTURE_1_NAME).bind()
  debugGPGPUPositionsMesh.use().setCamera(orthoCamera).draw()

  gl.activeTexture(gl.TEXTURE0)
  swapRenderer.getTexture(VELOCITIES_TEXTURE_1_NAME).bind()
  debugGPGPUVelocitiesMesh.use().setCamera(orthoCamera).draw()

  gl.activeTexture(gl.TEXTURE0)
  texturePosition.bind()
  debugBoxesPositionsMesh.use().setCamera(orthoCamera).draw()

  gl.activeTexture(gl.TEXTURE0)
  textureNormal.bind()
  debugBoxesNormalsMesh.use().setCamera(orthoCamera).draw()

  gl.activeTexture(gl.TEXTURE0)
  textureColor.bind()
  debugBoxesColorsMesh.use().setCamera(orthoCamera).draw()

  gl.activeTexture(gl.TEXTURE0)
  depthTexture.bind()
  debugBoxesDepthMesh.use().setCamera(orthoCamera).draw()
}

function createDebugPlane(width, height, x, y, defines = {}) {
  const { vertices, uv, indices } = GeometryUtils.createPlane({
    width,
    height,
  })
  const geometry = new Geometry(gl)
    .addAttribute('position', { typedArray: vertices, size: 3 })
    .addAttribute('uv', { typedArray: uv, size: 2 })
    .addIndex({ typedArray: indices })
  const mesh = new Mesh(gl, {
    geometry,
    uniforms: {
      sampler: { type: UNIFORM_TYPE_INT, value: 0 },
    },
    defines: {
      ...defines,
      INCLUDE_UVS: 1,
    },
    vertexShaderSource: BASE_VERTEX_SHADER,
    fragmentShaderSource: PLANE_DEBUG_FRAGMENT_SHADER,
  })
  mesh.setPosition({ x: x + width / 2, y: y + height / 2 })
  return mesh
}
