uniform sampler2D u_solid_color;
uniform sampler2D u_solid_depth;

uniform sampler2D u_translucent_terrain_color;
uniform sampler2D u_translucent_terrain_depth;

uniform sampler2D u_translucent_entity_color;
uniform sampler2D u_translucent_entity_depth;

uniform sampler2D u_translucent_particles_color;
uniform sampler2D u_translucent_particles_depth;

uniform sampler2D u_misc_color;
uniform sampler2D u_misc_depth;

layout(location = 0) out vec4 out_color;
layout(location = 1) out float out_depth;

struct layer {
	vec4 color;
	float depth;
};

layer layers[5];
uint layers_loaded = 0u;

void load_layer(sampler2D color_s, sampler2D depth_s) {
	vec4 color = texelFetch(color_s, ivec2(gl_FragCoord.xy), 0);
	float depth = texelFetch(depth_s, ivec2(gl_FragCoord.xy), 0).x;

	uint l = 0u;

	for(; l < layers_loaded; ++l) {
		if(depth <= layers[l].depth) {
			for(uint to = layers_loaded; to > l; --to) {
				uint from = to - 1u;
				layers[to] = layers[from];
			}
			break;
		}
	}

	layers[l] = layer(color, depth);
	++layers_loaded;
}

void main() {
	load_layer(u_solid_color, u_solid_depth);
	load_layer(u_translucent_terrain_color, u_translucent_terrain_depth);
	load_layer(u_translucent_entity_color, u_translucent_entity_depth);
	load_layer(u_translucent_particles_color, u_translucent_particles_depth);
	load_layer(u_misc_color, u_misc_depth);

	vec3 result = vec3(0.0);

	for(uint l = 0u; l < layers_loaded; ++l) {
		vec4 c = layers[layers_loaded - l - 1u].color;
		result = (result * (1.0 - c.a)) + c.rgb;
	}

	out_color = vec4(result, 1.0);
	out_depth = layers[0u].depth;
}