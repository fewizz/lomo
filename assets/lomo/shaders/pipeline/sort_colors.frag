#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/blend.glsl

/* lomo:pipeline/copy_to_array.frag */

uniform sampler2D u_solid_c;
uniform sampler2D u_translucent_c;
uniform sampler2D u_entity_c;
uniform sampler2D u_particle_c;
uniform sampler2D u_weather_c;

uniform sampler2D u_index_to_type;

layout(location = 0) out vec4 out_colors;

void main() {
	ivec2 coord = ivec2(gl_FragCoord.xy);

	const uint layers = 2u;
	vec4 values[layers] = vec4[] (
		texelFetch(u_solid_c, coord, 0),
		texelFetch(u_translucent_c, coord, 0)//,
		//texelFetch(u_entity_c, coord, 0),
		//texelFetch(u_particle_c, coord, 0),
		//texelFetch(u_weather_c, coord, 0)
	);

	uint index_to_type = floatBitsToUint(
		texelFetch(u_index_to_type, coord, 0).r
	);
	uint indices[layers];

	for(uint i = 0u; i < layers; i++) {
		indices[i] = (index_to_type >> (4u*i)) & 0xFu;
	}

	// with translucent
	vec3 color = values[indices[int(layers) - 1]].rgb;

	for(int i = int(layers) - 2; i >= 0; --i) {
		color = blend(color, values[indices[i]]);
	}

	out_colors = vec4(color, 1.0);
}