#include frex:shaders/api/header.glsl
#extension GL_ARB_explicit_attrib_location : require
#include canvas:shaders/pipeline/pipeline.glsl

// lomo:sort.frag

uniform sampler2D u_solid;
uniform sampler2D u_solid_depth;
uniform sampler2D u_translucent;
uniform sampler2D u_translucent_depth;
uniform sampler2D u_entity;
uniform sampler2D u_entity_depth;
uniform sampler2D u_particles;
uniform sampler2D u_particles_depth;
uniform sampler2D u_weather;
uniform sampler2D u_weather_depth;
uniform sampler2D u_clouds;
uniform sampler2D u_clouds_depth;

in vec2 vs_uv;

layout(location = 0) out vec4 out_sorted_color;
layout(location = 1) out vec4 out_sorted_depth;

layout(location = 2) out vec4 out_sorted_without_translucent_color;
layout(location = 3) out vec4 out_sorted_without_translucent_depth;

#define NUM_LAYERS 6

vec4 color_layers[NUM_LAYERS];
float depth_layers[NUM_LAYERS];
int active_layers = 0;

void try_insert(vec4 color, float depth) {
	if (color.a == 0.0) {
		return;
	}

	color_layers[active_layers] = color;
	depth_layers[active_layers] = depth;

	int target = active_layers++;
	int probe = target - 1;

	while (target > 0 && depth_layers[target] > depth_layers[probe]) {
		float probeDepth = depth_layers[probe];
		depth_layers[probe] = depth_layers[target];
		depth_layers[target] = probeDepth;

		vec4 probeColor = color_layers[probe];
		color_layers[probe] = color_layers[target];
		color_layers[target] = probeColor;

		target = probe--;
	}
}

vec3 blend(vec3 dst, vec4 src) {
	return (dst * (1.0 - src.a)) + src.rgb;
}

void main() {
	color_layers[0] = vec4(texture(u_solid, vs_uv).rgb, 1.0);
	depth_layers[0] = texture(u_solid_depth, vs_uv).r;
	active_layers = 1;

	try_insert(texture(u_entity, vs_uv), texture(u_entity_depth, vs_uv).r);
	try_insert(texture(u_particles, vs_uv), texture(u_particles_depth, vs_uv).r);
	try_insert(texture(u_weather, vs_uv), texture(u_weather_depth, vs_uv).r);
	try_insert(texture(u_clouds, vs_uv), texture(u_clouds_depth, vs_uv).r);

	vec3 accum = color_layers[0].rgb;

	for (int i = 1; i < active_layers; ++i) {
		accum = blend(accum, color_layers[i]);
	}

	out_sorted_without_translucent_color = vec4(accum.rgb, 1.0);
	out_sorted_without_translucent_depth = vec4(depth_layers[active_layers - 1], 0, 0, 1);

	try_insert(texture(u_translucent, vs_uv), texture(u_translucent_depth, vs_uv).r);

	accum = color_layers[0].rgb;

	for (int i = 1; i < active_layers; ++i) {
		accum = blend(accum, color_layers[i]);
	}

	out_sorted_color = vec4(accum.rgb, 1.0);
	out_sorted_depth = vec4(depth_layers[active_layers - 1], 0, 0, 1);
}


