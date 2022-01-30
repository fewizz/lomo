#include frex:shaders/api/header.glsl

/* lomo:pipeline/copy_to_array.frag */

uniform sampler2D u_solid;
uniform sampler2D u_solid_before_hand;
uniform sampler2D u_translucent;
uniform sampler2D u_entity;
uniform sampler2D u_particle;
uniform sampler2D u_weather;
uniform sampler2D u_cloud;

uniform sampler2D u_index_to_type;

layout(location = 0) out vec4 out_values[2];

void main() {
	ivec2 coord = ivec2(gl_FragCoord.xy);

	vec4 values[7] = vec4[] (
		texelFetch(u_solid, coord, 0),
		texelFetch(u_solid_before_hand, coord, 0),
		texelFetch(u_translucent, coord, 0),
		texelFetch(u_entity, coord, 0),
		texelFetch(u_particle, coord, 0),
		texelFetch(u_weather, coord, 0),
		texelFetch(u_cloud, coord, 0)
	);

	uint index_to_type = floatBitsToUint(texelFetch(u_index_to_type, coord, 0).r);

	uint indices[2];

	for(uint i = 0u; i < 2u; i++) {
		indices[i] = (index_to_type >> (4u*i)) & 0xFu;
	}

	out_values[0] = values[indices[0]];
	out_values[1] = values[indices[0] != 2u ? indices[0] : indices[1]];
}