import './index.css'

import { GUI } from 'dat.gui'
import Stats from 'stats.js'

import {
  Geometry,
  PerspectiveCamera,
  Mesh,
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
import DIRECTIONAL_LIGHT_FRAGMENT_SHADER from './glsl/directional-lighting.frag'
import PLANE_DEBUG_FRAGMENT_SHADER from './glsl/debug-plane.frag'
import { toHalf } from './helpers'
import { UNIFORM_TYPE_VEC4 } from './lib/hwoa-rang-gl/dist/esm'

const UPDATE_VELOCITIES_PROGRAM_NAME = 'updateVelocities'
const UPDATE_POSITIONS_PROGRAM_NAME = 'updatePositions'

const VELOCITIES_TEXTURE_1_NAME = 'velocitiesTexture1'
const VELOCITIES_TEXTURE_2_NAME = 'velocitiesTexture2'

const POSITIONS_TEXTURE_1_NAME = 'positionsTexture1'
const POSITIONS_TEXTURE_2_NAME = 'positionsTexture2'

const MAX_ALLOWED_POINT_LIGHTS = 200

const queryParams = new URLSearchParams(location.search)

const OPTIONS = {
  SPEED_LIMIT: 3,
  BOUNDS_X: 80,
  BOUNDS_Y: 80,
  BOUNDS_Z: 120,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 100,
  PARTICLE_COUNT: parseInt(queryParams.get('particleCount')) || 10000,

  pointLightActive: 80,
  debugMode: false,
  dirLightFactor: 0.0225,
}

const PARTICLE_TEXTURE_WIDTH = Math.floor(Math.sqrt(OPTIONS.PARTICLE_COUNT))
const PARTICLE_TEXTURE_HEIGHT = Math.floor(Math.sqrt(OPTIONS.PARTICLE_COUNT))

const stats = new Stats()
stats.showPanel(0)
document.body.appendChild(stats.dom)
stats.dom.style.setProperty('display', 'none')

const guiControls = new GUI()
guiControls
  .add(OPTIONS, 'debugMode')
  .name('Debug Mode')
  .onChange((v) => {
    if (v) {
      stats.dom.style.setProperty('display', 'block')
    } else {
      stats.dom.style.setProperty('display', 'none')
    }
  })
guiControls
  .add(OPTIONS, 'PARTICLE_COUNT', [10000, 40000, 100000])
  .name('Box Count')
  .onChange((val) => {
    const queryParams = new URLSearchParams()
    queryParams.append('particleCount', val)
    location.replace(`${location.origin}?${queryParams.toString()}`)
  })
guiControls
  .add(OPTIONS, 'pointLightActive')
  .min(0)
  .max(MAX_ALLOWED_POINT_LIGHTS)
  .name('Point lights count')
guiControls
  .add(OPTIONS, 'dirLightFactor')
  .min(0.005)
  .max(1)
  .step(0.001)
  .onChange((val) => {
    directionalLightMesh
      .use()
      .setUniform('lightFactor', UNIFORM_TYPE_FLOAT, val)
  })
  .name('Light Factor')
guiControls
  .add(OPTIONS, 'BOUNDS_X')
  .min(40)
  .max(90)
  .step(1)
  .onChange((val) => {
    swapRenderer
      .useProgram(UPDATE_VELOCITIES_PROGRAM_NAME)
      // @ts-ignore
      .setUniform('worldBounds', UNIFORM_TYPE_VEC3, [
        val,
        OPTIONS.BOUNDS_Y,
        OPTIONS.BOUNDS_Z,
      ])
      .useProgram(UPDATE_POSITIONS_PROGRAM_NAME)
      // @ts-ignore
      .setUniform('worldBounds', UNIFORM_TYPE_VEC3, [
        val,
        OPTIONS.BOUNDS_Y,
        OPTIONS.BOUNDS_Z,
      ])
    // directionalLightMesh
    //   .use()
    //   .setUniform('lightFactor', UNIFORM_TYPE_FLOAT, val)
  })
  .name('World Size X')
guiControls
  .add(OPTIONS, 'BOUNDS_Y')
  .min(40)
  .max(90)
  .step(1)
  .onChange((val) => {
    swapRenderer
      .useProgram(UPDATE_VELOCITIES_PROGRAM_NAME)
      // @ts-ignore
      .setUniform('worldBounds', UNIFORM_TYPE_VEC3, [
        OPTIONS.BOUNDS_X,
        val,
        OPTIONS.BOUNDS_Z,
      ])
      .useProgram(UPDATE_POSITIONS_PROGRAM_NAME)
      // @ts-ignore
      .setUniform('worldBounds', UNIFORM_TYPE_VEC3, [
        OPTIONS.BOUNDS_X,
        val,
        OPTIONS.BOUNDS_Z,
      ])
    // directionalLightMesh
    //   .use()
    //   .setUniform('lightFactor', UNIFORM_TYPE_FLOAT, val)
  })
  .name('World Size Y')

const pointLightMeshes = []
const pointLightPositions = []
const pointLightRadiuses = []
const pointLightMoveRadiuses = []

let oldTime = 0
let oldWidth = innerWidth
let oldHeight = innerHeight

let rAf
let boxesMesh
let directionalLightMesh

let debugGPGPUPositionsMesh
let debugGPGPUVelocitiesMesh
let debugBoxesPositionsMesh
let debugBoxesNormalsMesh
let debugBoxesColorsMesh
let debugBoxesDepthMesh

let gBuffer

let texturePositionFramebufferFallback
let textureNormalFramebufferFallback
let textureColorFramebufferFallback
let textureDepthFramebufferFallback

let texturePosition
let textureNormal
let textureColor
let depthTexture

const canvas = document.createElement('canvas')

document.body.appendChild(canvas)

const gl = canvas.getContext('webgl')

const mousePos = [0, 0, 0]
const mousePosTarget = [...mousePos]

const cameraPos = [0, 0, OPTIONS.BOUNDS_Z / 2 + 10]
const cameraPosTarget = [...cameraPos]

/*
  Camera setup
*/
const perspCamera = new PerspectiveCamera(
  (45 * Math.PI) / 180,
  innerWidth / innerHeight,
  OPTIONS.CAMERA_NEAR,
  OPTIONS.CAMERA_FAR,
)
perspCamera.setPosition({ x: 0, y: 0, z: OPTIONS.BOUNDS_Z / 2 + 10 })
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

// new CameraController(perspCamera)

/*
  GPGPU SwapRenderer
*/
const swapRenderer = new SwapRenderer(gl)
const ids = new Array(OPTIONS.PARTICLE_COUNT).fill(0).map((_, i) => i)
const positions = ids
  .map(() => [
    (Math.random() * 2 - 1) * OPTIONS.BOUNDS_X * 0.3,
    (Math.random() * 2 - 1) * OPTIONS.BOUNDS_Y * 0.3,
    (Math.random() * 2 - 1) * OPTIONS.BOUNDS_Z * 0.4,
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
    Math.random() * 20,
    1,
  ])
  .flat()
const typedVelocities = Framebuffer.supportRenderingToFloat(gl)
  ? new Float32Array(velocities)
  : new Uint16Array(velocities.map(toHalf))

swapRenderer
  .createProgram(
    UPDATE_VELOCITIES_PROGRAM_NAME,
    BASE_VERTEX_SHADER,
    BOXES_UPDATE_VELOCITIES_FRAGMENT_SHADER,
    {
      SPEED_LIMIT: `${OPTIONS.SPEED_LIMIT}.0`,
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

  /*
    Init two textures for updating positions on the GPU
  */
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

  /*
    Init two textures for updating velocities on the GPU
  */
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

  /*
    GPGPU program to update positions
  */
  .useProgram(UPDATE_POSITIONS_PROGRAM_NAME)
  // @ts-ignore
  .setUniform('worldBounds', UNIFORM_TYPE_VEC3, [
    OPTIONS.BOUNDS_X,
    OPTIONS.BOUNDS_Y,
    OPTIONS.BOUNDS_Z,
  ])
  // @ts-ignore
  .setUniform('positionsTexture', UNIFORM_TYPE_INT, 0)
  // @ts-ignore
  .setUniform('velocitiesTexture', UNIFORM_TYPE_INT, 1)
  // @ts-ignore
  .setUniform('textureDimensions', UNIFORM_TYPE_VEC2, [
    PARTICLE_TEXTURE_WIDTH,
    PARTICLE_TEXTURE_HEIGHT,
  ])

  /*
    GPGPU program to update velocities
  */
  .useProgram(UPDATE_VELOCITIES_PROGRAM_NAME)
  // @ts-ignore
  .setUniform('worldBounds', UNIFORM_TYPE_VEC3, [
    OPTIONS.BOUNDS_X,
    OPTIONS.BOUNDS_Y,
    OPTIONS.BOUNDS_Z,
  ])
  // @ts-ignore
  .setUniform('mousePos', UNIFORM_TYPE_VEC3, mousePos)
  // @ts-ignore
  .setUniform('predator0', UNIFORM_TYPE_VEC4, [0, 0, 0, 0])
  // @ts-ignore
  .setUniform('positionsTexture', UNIFORM_TYPE_INT, 0)
  // @ts-ignore
  .setUniform('velocitiesTexture', UNIFORM_TYPE_INT, 1)
  // @ts-ignore
  .setUniform('textureDimensions', UNIFORM_TYPE_VEC2, [
    PARTICLE_TEXTURE_WIDTH,
    PARTICLE_TEXTURE_HEIGHT,
  ])

/*
  Require needed WebGL extensions
*/
const drawBuffersExtension = getExtension(gl, 'WEBGL_draw_buffers')
const halfFloatTexExtension = getExtension(gl, 'OES_texture_half_float')
const depthTextureExtension = getExtension(gl, 'WEBGL_depth_texture')

/*
  Add color attachments to GBUffer if WEBGL_depth_texture is available
*/
if (drawBuffersExtension) {
  gBuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, gBuffer)
}

texturePosition = new Texture(gl, {
  type: Framebuffer.supportRenderingToFloat(gl)
    ? gl.FLOAT
    : halfFloatTexExtension.HALF_FLOAT_OES,
  format: gl.RGB,
  minFilter: gl.NEAREST,
  magFilter: gl.NEAREST,
})
  .bind()
  .fromSize(innerWidth, innerHeight)

if (drawBuffersExtension) {
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    drawBuffersExtension.COLOR_ATTACHMENT0_WEBGL,
    gl.TEXTURE_2D,
    texturePosition.getTexture(),
    0,
  )
}

textureNormal = new Texture(gl, {
  type: Framebuffer.supportRenderingToFloat(gl)
    ? gl.FLOAT
    : halfFloatTexExtension.HALF_FLOAT_OES,
  format: gl.RGB,
  minFilter: gl.NEAREST,
  magFilter: gl.NEAREST,
})
  .bind()
  .fromSize(innerWidth, innerHeight)

if (drawBuffersExtension) {
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    drawBuffersExtension.COLOR_ATTACHMENT1_WEBGL,
    gl.TEXTURE_2D,
    textureNormal.getTexture(),
    0,
  )
}

textureColor = new Texture(gl, {
  type: Framebuffer.supportRenderingToFloat(gl)
    ? gl.FLOAT
    : halfFloatTexExtension.HALF_FLOAT_OES,
  format: gl.RGB,
  minFilter: gl.NEAREST,
  magFilter: gl.NEAREST,
})
  .bind()
  .fromSize(innerWidth, innerHeight)

if (drawBuffersExtension) {
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    drawBuffersExtension.COLOR_ATTACHMENT2_WEBGL,
    gl.TEXTURE_2D,
    textureColor.getTexture(),
    0,
  )
}

depthTexture = new Texture(gl, {
  minFilter: gl.LINEAR,
  magFilter: gl.LINEAR,
  type: gl.UNSIGNED_SHORT,
  format: gl.DEPTH_COMPONENT,
})
  .bind()
  .setIsFlip(0)
  .fromSize(innerWidth, innerHeight)
if (drawBuffersExtension) {
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.DEPTH_ATTACHMENT,
    gl.TEXTURE_2D,
    depthTexture.getTexture(),
    0,
  )
}

const supportGBuffer =
  drawBuffersExtension &&
  gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE

if (supportGBuffer) {
  /*
    Assign color attachments to GBUffer if WEBGL_depth_texture
    is available
  */
  drawBuffersExtension.drawBuffersWEBGL([
    drawBuffersExtension.COLOR_ATTACHMENT0_WEBGL, // gl_FragData[0]
    drawBuffersExtension.COLOR_ATTACHMENT1_WEBGL, // gl_FragData[1]
    drawBuffersExtension.COLOR_ATTACHMENT2_WEBGL, // gl_FragData[2]
  ])
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
} else {
  /*
    If WEBGL_depth_texture is not available, initialise separate
    framebuffers with separate color attachments
  */
  texturePositionFramebufferFallback = new Framebuffer(gl, {
    inputTexture: texturePosition,
    width: innerWidth,
    height: innerHeight,
  })
  textureNormalFramebufferFallback = new Framebuffer(gl, {
    inputTexture: textureNormal,
    width: innerWidth,
    height: innerHeight,
  })
  textureColorFramebufferFallback = new Framebuffer(gl, {
    inputTexture: textureColor,
    width: innerWidth,
    height: innerHeight,
  })
  textureDepthFramebufferFallback = new Framebuffer(gl, {
    width: innerWidth,
    height: innerHeight,
    useDepthRenderBuffer: false,
  })
}

/*
  Initialise boxes as instanced mesh
*/
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
    instanceCount: OPTIONS.PARTICLE_COUNT,
    defines: {
      G_BUFFER_SUPPORTED: supportGBuffer ? 1 : 0,
    },
    uniforms: {
      fallbackGBufferMode: { type: UNIFORM_TYPE_INT, value: 0 },
      time: { type: UNIFORM_TYPE_FLOAT, value: 0 },
      positionsTexture: { type: UNIFORM_TYPE_INT, value: 0 },
      velocitiesTexture: { type: UNIFORM_TYPE_INT, value: 1 },
      textureDimensions: {
        type: UNIFORM_TYPE_VEC2,
        value: [PARTICLE_TEXTURE_WIDTH, PARTICLE_TEXTURE_HEIGHT],
      },
      fogDensity: { type: UNIFORM_TYPE_FLOAT, value: 0.4 },
    },
    vertexShaderSource: BOX_VERTEX_SHADER,
    fragmentShaderSource: BOX_FRAGMENT_SHADER,
  })
}

/*
  Initialise point light meshes
*/
{
  const { vertices, indices } = GeometryUtils.createCircle({
    segments: 30,
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
      value: [innerWidth * devicePixelRatio, innerHeight * devicePixelRatio],
    },
  }

  for (let i = 0; i < MAX_ALLOWED_POINT_LIGHTS; i++) {
    const radius = Math.random() * 12
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
    pointLightMoveRadiuses.push([
      OPTIONS.BOUNDS_X * (Math.random() * 0.3 + 0.2),
      OPTIONS.BOUNDS_Y * (Math.random() * 0.3 + 0.2),
    ])
  }
}

/*
  Initialise directional light fullscreen quad mesh
*/
{
  const { indices, vertices } = GeometryUtils.createPlane({
    width: innerWidth,
    height: innerHeight,
  })
  const geometry = new Geometry(gl)
    .addIndex({ typedArray: indices })
    .addAttribute('position', { typedArray: vertices, size: 3 })

  directionalLightMesh = new Mesh(gl, {
    geometry,
    uniforms: {
      resolution: {
        type: UNIFORM_TYPE_VEC2,
        value: [innerWidth * devicePixelRatio, innerHeight * devicePixelRatio],
      },
      positionTexture: { type: UNIFORM_TYPE_INT, value: 0 },
      normalTexture: { type: UNIFORM_TYPE_INT, value: 1 },
      colorTexture: { type: UNIFORM_TYPE_INT, value: 2 },
      lightDirection: { type: UNIFORM_TYPE_VEC3, value: [10, 10, 0] },
      lightFactor: { type: UNIFORM_TYPE_FLOAT, value: OPTIONS.dirLightFactor },
    },
    vertexShaderSource: BASE_VERTEX_SHADER,
    fragmentShaderSource: DIRECTIONAL_LIGHT_FRAGMENT_SHADER,
  })
}

/*
  Initialise debug quad meshes
*/
{
  const debugMeshHeightReference = 100
  const debugMeshHeightDelta = debugMeshHeightReference / innerHeight

  const gpgpuDebugWidth = debugMeshHeightReference
  const gpgpguDebugHeight = debugMeshHeightReference

  const gBufferDebugWidth = innerWidth * debugMeshHeightDelta
  const gBufferDebugHeight = innerHeight * debugMeshHeightDelta

  const padding = 20

  let debugMeshAccumulatedX = padding

  debugGPGPUPositionsMesh = createDebugPlane(
    gpgpuDebugWidth,
    gpgpguDebugHeight,
    -innerWidth / 2 + debugMeshAccumulatedX,
    -innerHeight / 2 + padding,
  )
  debugMeshAccumulatedX += gpgpuDebugWidth
  debugGPGPUVelocitiesMesh = createDebugPlane(
    gpgpuDebugWidth,
    gpgpguDebugHeight,
    -innerWidth / 2 + debugMeshAccumulatedX,
    -innerHeight / 2 + padding,
  )
  debugMeshAccumulatedX += gpgpuDebugWidth + padding
  debugBoxesPositionsMesh = createDebugPlane(
    gBufferDebugWidth,
    gBufferDebugHeight,
    -innerWidth / 2 + debugMeshAccumulatedX,
    -innerHeight / 2 + padding,
  )
  debugMeshAccumulatedX += gBufferDebugWidth

  debugBoxesNormalsMesh = createDebugPlane(
    gBufferDebugWidth,
    gBufferDebugHeight,
    -innerWidth / 2 + debugMeshAccumulatedX,
    -innerHeight / 2 + padding,
  )
  debugMeshAccumulatedX += gBufferDebugWidth

  debugBoxesColorsMesh = createDebugPlane(
    gBufferDebugWidth,
    gBufferDebugHeight,
    -innerWidth / 2 + debugMeshAccumulatedX,
    -innerHeight / 2 + padding,
  )
  debugMeshAccumulatedX += gBufferDebugWidth

  debugBoxesDepthMesh = createDebugPlane(
    gBufferDebugWidth,
    gBufferDebugHeight,
    -innerWidth / 2 + debugMeshAccumulatedX,
    -innerHeight / 2 + padding,
    {
      IS_DEPTH_TEXTURE: 1,
      NEAR_PLANE: OPTIONS.CAMERA_NEAR,
      FAR_PLANE: `${OPTIONS.CAMERA_FAR}.0`,
    },
  )
}

document.body.addEventListener('mousemove', onMouseMove)
document.body.addEventListener('touchmove', onTouchMove)
window.addEventListener('blur', onWindowBlur)
window.addEventListener('focus', onWindowFocus)
window.addEventListener('resize', () => sizeCanvas(true))

sizeCanvas(false)
rAf = requestAnimationFrame(drawFrame)

function onMouseMove(e) {
  mousePosTarget[0] = (e.pageX - innerWidth / 2) / innerWidth
  mousePosTarget[1] = -(e.pageY - innerHeight / 2) / innerHeight

  cameraPosTarget[0] = mousePosTarget[0] * 20
  cameraPosTarget[1] = mousePosTarget[1] * 20
}

function onTouchMove(e) {
  e.preventDefault()
}

function onWindowBlur() {
  cancelAnimationFrame(rAf)
}

function onWindowFocus() {
  oldTime = performance.now() / 1000
  rAf = requestAnimationFrame(drawFrame)
}

function sizeCanvas(updateCameras = true) {
  canvas.width = innerWidth * devicePixelRatio
  canvas.height = innerHeight * devicePixelRatio
  canvas.style.setProperty('width', `${innerWidth}px`)
  canvas.style.setProperty('height', `${innerHeight}px`)

  if (updateCameras) {
    orthoCamera.left = -innerWidth / 2
    orthoCamera.right = innerWidth / 2
    orthoCamera.top = innerHeight / 2
    orthoCamera.bottom = -innerHeight / 2
    orthoCamera.updateProjectionMatrix()

    perspCamera.aspect = innerWidth / innerHeight
    perspCamera.updateProjectionMatrix()
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, gBuffer)
  texturePosition.bind().fromSize(innerWidth, innerHeight)
  textureNormal.bind().fromSize(innerWidth, innerHeight)
  textureColor.bind().fromSize(innerWidth, innerHeight)
  depthTexture.bind().fromSize(innerWidth, innerHeight)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  const scaleX = 1 + oldWidth / innerWidth
  const scaleY = 1 + oldHeight / innerHeight

  oldWidth = innerWidth
  oldHeight = innerHeight

  directionalLightMesh.setScale({ x: scaleX, y: scaleY })
  directionalLightMesh
    .use()
    .setUniform('resolution', UNIFORM_TYPE_VEC2, [
      innerWidth * devicePixelRatio,
      innerHeight * devicePixelRatio,
    ])

  pointLightMeshes.forEach((mesh) =>
    mesh
      .use()
      .setUniform('resolution', UNIFORM_TYPE_VEC2, [
        innerWidth * devicePixelRatio,
        innerHeight * devicePixelRatio,
      ]),
  )
}

function drawFrame(ts) {
  ts /= 1000
  const dt = ts - oldTime
  oldTime = ts

  stats.begin()

  rAf = requestAnimationFrame(drawFrame)

  mousePosTarget[2] = Math.sin(ts * 0.2) * 2

  const mouseSpeed = dt * 5
  mousePos[0] += (mousePosTarget[0] - mousePos[0]) * mouseSpeed
  mousePos[1] += (mousePosTarget[1] - mousePos[1]) * mouseSpeed
  mousePos[2] += (mousePosTarget[2] - mousePos[2]) * mouseSpeed

  cameraPos[0] += (cameraPosTarget[0] - cameraPos[0]) * dt
  cameraPos[1] += (cameraPosTarget[1] - cameraPos[1]) * dt
  cameraPos[2] += (cameraPosTarget[2] - cameraPos[2]) * dt

  perspCamera
    .setPosition({ x: cameraPos[0], y: cameraPos[1], z: cameraPos[2] })
    .updateViewMatrix()

  /*
    Update velocities and positions on the GPU
  */
  gl.disable(gl.BLEND)
  swapRenderer
    .setSize(PARTICLE_TEXTURE_WIDTH, PARTICLE_TEXTURE_HEIGHT)
    .useProgram(UPDATE_VELOCITIES_PROGRAM_NAME)
    // @ts-ignore
    .setUniform('mousePos', UNIFORM_TYPE_VEC3, mousePos)
    // @ts-ignore
    .setUniform('predator0', UNIFORM_TYPE_VEC4, [
      Math.sin(ts * 20) * 30,
      Math.cos(ts * 20) * 30,
      0,
      0,
    ])
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

  gl.viewport(0, 0, innerWidth, innerHeight)
  gl.clearColor(0.1, 0.1, 0.1, 1.0)

  gl.blendFunc(gl.ONE, gl.ONE)
  gl.depthFunc(gl.LEQUAL)

  /*
    Render positions, normals and colors to MRT in one go if
    WEBGL_draw_buffers available
  */
  if (supportGBuffer) {
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
  } else {
    /*
      Render positions, normals and colors to separate framebuffers in
      different drawcalls if WEBGL_draw_buffers not available
    */
    ;[
      texturePositionFramebufferFallback,
      textureNormalFramebufferFallback,
      textureColorFramebufferFallback,
      textureDepthFramebufferFallback,
    ].map((framebuffer, i) => {
      framebuffer.bind()
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
        .setUniform('fallbackGBufferMode', UNIFORM_TYPE_INT, i)
        .setUniform('time', UNIFORM_TYPE_FLOAT, ts)
        .setCamera(perspCamera)
        .draw()
      framebuffer.unbind()
    })
  }
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)

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

  pointLightMeshes
    .filter((_, i) => i < OPTIONS.pointLightActive)
    .forEach((mesh, i) => {
      const position = pointLightPositions[i]
      const radius = pointLightRadiuses[i]
      const moveRadius = pointLightMoveRadiuses[i]
      const rotSpeed = ts * 0.25
      position[0] =
        Math.cos(rotSpeed + i * (i % 2 === 0 ? 1 : -1)) * moveRadius[0]
      position[1] =
        Math.sin(rotSpeed + i * (i % 2 === 0 ? 1 : -1)) * moveRadius[1]
      position[2] += dt * 12
      if (position[2] > OPTIONS.BOUNDS_Z / 2 + radius) {
        position[2] = -OPTIONS.BOUNDS_Z / 2
      }
      mesh
        .use()
        .setPosition({
          x: position[0],
          y: position[1],
          z: position[2],
        })
        .setUniform(
          'PointLight.position',
          UNIFORM_TYPE_VEC3,
          pointLightPositions[i],
        )
        .setCamera(perspCamera)
        .draw()
    })

  directionalLightMesh.use().setCamera(orthoCamera).draw()

  if (OPTIONS.debugMode) {
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
    if (supportGBuffer) {
      depthTexture.bind()
    } else {
      textureDepthFramebufferFallback.depthTexture.bind()
    }
    debugBoxesDepthMesh.use().setCamera(orthoCamera).draw()
  }

  stats.end()
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
