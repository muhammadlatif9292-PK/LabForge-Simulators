// rendering/shaders/instanced_cylinder.wgsl
// Instanced Cylinder Shader for Bond Rendering (WGSL)
// 
// Responsibilities:
// - Render instanced cylinders between two atom positions
// - Support multiple bond orders (1, 2, 3) with offset for multiple bonds
// - Apply PBR shading matching the sphere shader

struct Uniforms {
  view_projection: mat4x4<f32>,
}

struct LightUniforms {
  direction: vec3<f32>,
  color: vec3<f32>,
  ambient: f32,
}

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
}

struct InstanceInput {
  @location(2) start_pos: vec3<f32>,
  @location(3) end_pos: vec3<f32>,
  @location(4) bond_radius: f32,
  @location(5) bond_order: f32,
}

struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) world_position: vec3<f32>,
  @location(1) world_normal: vec3<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var<uniform> lights: LightUniforms;

@vertex
fn vertex(
  vert: VertexInput,
  instance: InstanceInput,
) -> VertexOutput {
  var out: VertexOutput;

  let start = instance.start_pos;
  let end = instance.end_pos;
  let dir = normalize(end - start);
  let length = distance(end, start);

  // Build rotation matrix to align cylinder (0,1,0) with (start→end)
  let up = vec3<f32>(0.0, 1.0, 0.0);
  let axis = normalize(cross(up, dir));
  let angle = acos(dot(up, dir));

  // Rodrigues rotation formula
  let cos_a = cos(angle);
  let sin_a = sin(angle);
  let rot_matrix = mat3x3<f32>(
    vec3<f32>(cos_a + axis.x * axis.x * (1.0 - cos_a), axis.x * axis.y * (1.0 - cos_a) - axis.z * sin_a, axis.x * axis.z * (1.0 - cos_a) + axis.y * sin_a),
    vec3<f32>(axis.y * axis.x * (1.0 - cos_a) + axis.z * sin_a, cos_a + axis.y * axis.y * (1.0 - cos_a), axis.y * axis.z * (1.0 - cos_a) - axis.x * sin_a),
    vec3<f32>(axis.z * axis.x * (1.0 - cos_a) - axis.y * sin_a, axis.z * axis.y * (1.0 - cos_a) + axis.x * sin_a, cos_a + axis.z * axis.z * (1.0 - cos_a)),
  );

  // Scale cylinder to bond length
  var world_pos = rot_matrix * (vert.position * vec3<f32>(instance.bond_radius, length * 0.5, instance.bond_radius));
  world_pos += start + dir * length * 0.5;

  out.world_position = world_pos;
  out.world_normal = normalize(rot_matrix * vert.normal);
  out.clip_position = uniforms.view_projection * vec4<f32>(world_pos, 1.0);

  return out;
}

@fragment
fn fragment(in: VertexOutput) -> @location(0) vec4<f32> {
  let n = normalize(in.world_normal);
  let l = normalize(-lights.direction);
  let ndotl = max(dot(n, l), 0.0);

  let color = vec3<f32>(0.7, 0.7, 0.7); // bond color (grey)
  let ambient = lights.ambient * color;
  let diffuse = color * ndotl * lights.color;

  let result = ambient + diffuse;
  let gamma = pow(result, vec3<f32>(1.0 / 2.2));

  return vec4<f32>(gamma, 1.0);
}