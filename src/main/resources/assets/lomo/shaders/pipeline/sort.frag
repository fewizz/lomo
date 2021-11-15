#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/sort.frag */

uniform sampler2D u_solid_c;
uniform sampler2D u_solid_n;
uniform sampler2D u_solid_d;
uniform sampler2D u_solid_e;

uniform sampler2D u_translucent_c;
uniform sampler2D u_translucent_n;
uniform sampler2D u_translucent_d;
uniform sampler2D u_translucent_e;

uniform sampler2D u_entity_c;
uniform sampler2D u_entity_n;
uniform sampler2D u_entity_d;
uniform sampler2D u_entity_e;

uniform sampler2D u_weather_c;
uniform sampler2D u_weather_n;
uniform sampler2D u_weather_d;
uniform sampler2D u_weather_e;

uniform sampler2D u_cloud_c;
uniform sampler2D u_cloud_d;

uniform sampler2D u_particle_c;
uniform sampler2D u_particle_n;
uniform sampler2D u_particle_d;
uniform sampler2D u_particle_e;

layout(location = 0) out vec4 out_sorted_without_translucent_c;
layout(location = 1) out vec4 out_sorted_without_translucent_n;
layout(location = 2) out vec4 out_sorted_without_translucent_d;

layout(location = 3) out vec4 out_sorted_with_translucent_c;
layout(location = 4) out vec4 out_sorted_with_translucent_n;
layout(location = 5) out vec4 out_sorted_with_translucent_d;

layout(location = 6) out vec4 out_sorted_all_c;

//out vec4 o[7];

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

vec3 accum() {
	vec3 r = color_layers[0].rgb;

	for (int i = 1; i < active_layers; ++i) {
		r = blend(r, color_layers[i]);
	}

	return r;
}

void main() {
	ivec2 coord = ivec2(gl_FragCoord.xy);

	color_layers[0] = vec4(texelFetch(u_solid_c, coord, 0).rgb, 1.0);
	depth_layers[0] = texelFetch(u_solid_d, coord, 0).r;
	normal_layers[0] = texelFetch(u_solid_n, coord, 0);

	active_layers = 1;

	try_insert(
		texelFetch(u_entity_c, coord, 0),
		texelFetch(u_entity_d, coord, 0).r,
		texelFetch(u_entity_n, coord, 0)
	);
	try_insert(
		texelFetch(u_cloud_c, coord, 0),
		texelFetch(u_cloud_d, coord, 0).r,
		vec4(0)
	);

	/*out_sorted_without_translucent*/
	out_sorted_without_translucent_c = vec4(accum(), 1.0);
	out_sorted_without_translucent_n = normal_layers[active_layers - 1];
	out_sorted_without_translucent_d = vec4(depth_layers[active_layers - 1], 0, 0, 1);

	try_insert(
		texelFetch(u_translucent_c, coord, 0),
		texelFetch(u_translucent_d, coord, 0).r,
		texelFetch(u_translucent_n, coord, 0)
	);

	/*out_sorted_with_translucent*/
	out_sorted_with_translucent_c = vec4(accum(), 1.0);
	out_sorted_with_translucent_n = normal_layers[active_layers - 1];
	out_sorted_with_translucent_d = vec4(depth_layers[active_layers - 1], 0, 0, 1);

	try_insert(
		texelFetch(u_particle_c, coord, 0),
		texelFetch(u_particle_d, coord, 0).r,
		texelFetch(u_particle_n, coord, 0)
	);
	try_insert(
		texelFetch(u_weather_c, coord, 0),
		texelFetch(u_weather_d, coord, 0).r,
		texelFetch(u_weather_n, coord, 0)
	);

	/*out_sorted_all_c*/
	out_sorted_all_c = vec4(accum(), 1.0);
}


