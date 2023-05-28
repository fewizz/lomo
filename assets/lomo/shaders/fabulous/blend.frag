uniform sampler2D u_solid_color;
uniform usampler2D u_solid_data;
uniform sampler2D u_solid_depth;

uniform sampler2D u_translucent_color;
uniform usampler2D u_translucent_data;
uniform sampler2D u_translucent_depth;

uniform sampler2D u_translucent_particles_color;
uniform usampler2D u_translucent_particles_data;
uniform sampler2D u_translucent_particles_depth;

uniform sampler2D u_weather_color;
uniform usampler2D u_weather_data;
uniform sampler2D u_weather_depth;

uniform sampler2D u_misc_color;
uniform usampler2D u_misc_data;
uniform sampler2D u_misc_depth;

layout(location = 0) out vec4 out_without_particles_color;
layout(location = 1) out uvec4 out_without_particles_data;
layout(location = 2) out float out_without_particles_depth;

layout(location = 3) out vec4 out_color;
layout(location = 4) out uvec4 out_data;
layout(location = 5) out float out_depth;

struct layer {
	vec4 color;
	uvec4 data;
	float depth;
};

const uint layers_count = 4u;
layer layers[layers_count];
uint layers_loaded = 0u;

void load_layer(sampler2D color_s, usampler2D data_s, sampler2D depth_s) {
	vec4 color = texelFetch(color_s, ivec2(gl_FragCoord.xy), 0);
	color.rgb = pow(color.rgb, vec3(2.2));
	uvec4 data = texelFetch(data_s, ivec2(gl_FragCoord.xy), 0);
	float depth = texelFetch(depth_s, ivec2(gl_FragCoord.xy), 0).x;

	if(color.a == 0.0) {
		return;
	}

	uint l = 0u;

	for(; l < layers_loaded; ++l) {
		if(depth >= layers[l].depth) {
			for(uint to = layers_loaded; to > l; --to) {
				uint from = to - 1u;
				layers[to] = layers[from];
			}
			break;
		}
	}

	layers[l] = layer(color, data, depth);
	++layers_loaded;
}

void main() {
	load_layer(u_solid_color, u_solid_data, u_solid_depth);
	load_layer(u_translucent_color, u_translucent_data, u_translucent_depth);

	vec3 result = vec3(0.0);

	for(uint l = 0u; l < layers_loaded; ++l) {
		vec4 c = layers[l].color;
		result = (result * (1.0 - c.a)) + c.rgb;
	}

	out_without_particles_color = vec4(result, 1.0);
	out_without_particles_data = layers[layers_loaded - 1u].data;
	out_without_particles_depth = layers[layers_loaded - 1u].depth;

	load_layer(u_translucent_particles_color, u_translucent_particles_data, u_translucent_particles_depth);
	load_layer(u_weather_color, u_weather_data, u_weather_depth);
	load_layer(u_misc_color, u_misc_data, u_misc_depth);

	result = vec3(0.0);

	for(uint l = 0u; l < layers_loaded; ++l) {
		vec4 c = layers[l].color;
		result = (result * (1.0 - c.a)) + c.rgb;
	}

	out_color = vec4(result, 1.0);
	out_data = layers[layers_loaded - 1u].data;
	out_depth = layers[layers_loaded - 1u].depth;
}