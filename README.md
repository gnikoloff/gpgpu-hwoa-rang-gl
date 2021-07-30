# WebGL boxes with GPGPU physics and deferred shading

![demo render](/src/assets/hwoa-rang-gl-demo-social.png?raw=true)

[https://gpgpu-boxes.georgi-nikolov.com/](https://gpgpu-boxes.georgi-nikolov.com/)

WebGL demo written with my personal library ![hwoa-rang-gl](https://gnikoloff.github.io/hwoa-rang-gl/)

Uses deferred shading to render up to 100 000 shaded boxes that are influenced from up to 200 dynamic point lights. Animation of the boxes positions and velocities is all offloaded to the GPU using framebuffer ping-ponging.

Key features:

- Renders all boxes in one draw call using geometry instancing
- For deferred shading, uses `WEBGL_draw_buffers` extension if available to write positions, colors and normals data to different textures simultaneously in one framebuffer. If extension not available (mainly mobile hardware), fallbacks to rendering each texture to different framebuffer
- Support for GPGPU animation by rendering to floating point textures via `OES_texture_float`. If not present, fallbacks to rendering to half floating point textures via `OES_texture_half_float`
- Uses Vertex Array Objects `OES_vertex_array_object` to group bindings for easier manipulation

### Alternative render

![alternative demo render](/src/assets/hwoa-rang-gl-demo-alternative-render.png?raw=true)

### Usage

```
git clone https://github.com/gnikoloff/gpgpu-hwoa-rang-gl
cd gpgpu-hwoa-rang-gl

# install dependencies
npm install

# start development server & watch files
npm run start:dev

# start server & build files
npm run start
```
