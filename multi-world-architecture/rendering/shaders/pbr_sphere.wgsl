// rendering/shaders/pbr_sphere.wgsl
// PBR Sphere Shader for Atom Rendering (WGSL)
// 
// Responsibilities:
// - Render instanced spheres with physically-based shading
// - Support per-instance color, radius, metallic, and roughness
// - Use Cook-Torrance BRDF for specular highlights
// - Apply gamma correction for sRGB output

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
  @location(2) uv: vec2<f32>,
}

struct InstanceInput {
  @location(3) instance_pos: vec3<f32>,
  @location(4) instance_color: vec3<f32>,
  @location(5) instance_radius: f32,
  @location(6) element_id: f32,
}

struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) world_position: vec3<f32>,
  @location(1) world_normal: vec3<f32>,
  @location(2) color: vec3<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var<uniform> lights: LightUniforms;

@vertex
fn vertex(
  vert: VertexInput,
  instance: InstanceInput,
) -> VertexOutput {
  var out: VertexOutput;

  // Scale sphere by instance radius
  let world_pos = vec4<f32>(
    vert.position * instance.radius + instance.instance_pos,
    1.0,
  );
  out.world_position = world_pos.xyz;
  out.world_normal = vert.normal;
  out.clip_position = uniforms.view_projection * world_pos;
  out.color = instance.instance_color;

  return out;
}

const PI: f32 = 3.14159265359;

fn distributionGGX(n: vec3<f32>, h: vec3<f32>, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let ndoth = max(dot(n, h), 0.0);
  let ndoth2 = ndoth * ndoth;
  let denom = ndoth2 * (a2 - 1.0) + 1.0;
  return a2 / (PI * denom * denom);
}

fn geometrySchlickGGX(ndotv: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return ndotv / (ndotv * (1.0 - k) + k);
}

fn geometrySmith(n: vec3<f32>, v: vec3<f32>, l: vec3<f32>, roughness: f32) -> f32 {
  let ndotv = max(dot(n, v), 0.0);
  let ndotl = max(dot(n, l), 0.0);
  return geometrySchlickGGX(ndotv, roughness) * geometrySchlickGGX(ndotl, roughness);
}

fn fresnelSchlick(cosTheta: f32, f0: vec3<f32>) -> vec3<f32> {
  return f0 + (1.0 - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

@fragment
fn fragment(in: VertexOutput) -> @location(0) vec4<f32> {
  let albedo = in.color;
  let metallic: f32 = 0.1;
  let roughness: f32 = 0.4;

  let n = normalize(in.world_normal);
  let v = normalize(vec3<f32>(0.0, 0.0, 1.0)); // camera direction simplified
  let l = normalize(-lights.direction);
  let h = normalize(v + l);

  // Base reflectivity
  let f0 = mix(vec3<f32>(0.04), albedo, metallic);

  // Cook-Torrance BRDF
  let ndf = distributionGGX(n, h, roughness);
  let g = geometrySmith(n, v, l, roughness);
  let f = fresnelSchlick(max(dot(h, v), 0.0), f0);

  let numerator = ndf * g * f;
  let denominator = 4.0 * max(dot(n, v), 0.0) * max(dot(n, l), 0.0) + 0.0001;
  let specular = numerator / denominator;

  // Diffuse (Lambertian)
  let kd = (1.0 - f) * (1.0 - metallic);
  let diffuse = kd * albedo / PI;

  let ndotl = max(dot(n, l), 0.0);
  let radiance = lights.color * ndotl;
  let ambient = lights.ambient * albedo;

  let color = ambient + (diffuse + specular) * radiance;

  // HDR tonemap + gamma correction
  let mapped = color / (color + vec3<f32>(1.0));
  let gamma = pow(mapped, vec3<f32>(1.0 / 2.2));

  return vec4<f32>(gamma, 1.0);
}