#include frex:shaders/api/header.glsl
#extension GL_ARB_explicit_attrib_location : require
#include canvas:shaders/pipeline/pipeline.glsl

// lomo:sort.frag

uniform sampler2D u_solid_c;
uniform sampler2D u_solid_n;
uniform sampler2D u_solid_d;

uniform sampler2D u_translucent_c;
uniform sampler2D u_translucent_n;
uniform sampler2D u_translucent_d;

uniform sampler2D u_entity_c;
uniform sampler2D u_entity_n;
uniform sampler2D u_entity_d;

uniform sampler2D u_weather_c;
uniform sampler2D u_weather_n;
uniform sampler2D u_weather_d;

uniform sampler2D u_cloud_c;
uniform sampler2D u_cloud_n;
uniform sampler2D u_cloud_d;

uniform sampler2D u_particle_c;
uniform sampler2D u_particle_n;
uniform sampler2D u_particle_d;

in vec2 vs_uv;

layout(location = 0) out vec4 out_sorted_c;
layout(location = 1) out vec4 out_sorted_d;
layout(location = 2) out vec4 out_sorted_n;

#define NUM_LAYERS 6

vec4 color_layers[NUM_LAYERS];
float depth_layers[NUM_LAYERS];
vec4 normal_layers[NUM_LAYERS];

int active_layers = 0;

void try_insert(vec4 color, float depth, vec4 normal) {
	if (color.a == 0.0) {
		return;
	}

	color_layers[active_layers] = color;
	depth_layers[active_layers] = depth;
	normal_layers[active_layers] = normal;

	int target = active_layers++;
	int probe = target - 1;

	while (target > 0 && depth_layers[target] > depth_layers[probe]) {
		float probeDepth = depth_layers[probe];
		depth_layers[probe] = depth_layers[target];
		depth_layers[target] = probeDepth;

		vec4 probeColor = color_layers[probe];
		color_layers[probe] = color_layers[target];
		color_layers[target] = probeColor;

		vec4 n = normal_layers[probe];
		normal_layers[probe] = normal_layers[target];
		normal_layers[target] = n;

		target = probe--;
	}
}

vec3 blend(vec3 dst, vec4 src) {
	return (dst * (1.0 - src.a)) + src.rgb;
}

void main() {
	color_layers[0] = vec4(texture(u_solid_c, vs_uv).rgb, 1.0);
	depth_layers[0] = texture(u_solid_d, vs_uv).r;
	normal_layers[0] = texture(u_solid_n, vs_uv);

	active_layers = 1;

	try_insert(texture(u_translucent_c, vs_uv), texture(u_translucent_d, vs_uv).r, texture(u_translucent_n, vs_uv));
	try_insert(texture(u_entity_c, vs_uv), texture(u_entity_d, vs_uv).r, texture(u_entity_n, vs_uv));
	try_insert(texture(u_particle_c, vs_uv), texture(u_particle_d, vs_uv).r, texture(u_particle_n, vs_uv));
	try_insert(texture(u_weather_c, vs_uv), texture(u_weather_d, vs_uv).r, texture(u_weather_n, vs_uv));
	try_insert(texture(u_cloud_c, vs_uv), texture(u_cloud_d, vs_uv).r, texture(u_cloud_n, vs_uv));

	vec3 accum = color_layers[0].rgb;

	for (int i = 1; i < active_layers; ++i) {
		accum = blend(accum, color_layers[i]);
	}

	out_sorted_c = vec4(accum.rgb, 1.0);
	out_sorted_d = vec4(depth_layers[active_layers - 1], 0, 0, 1);
	out_sorted_n = normal_layers[active_layers - 1];
}


