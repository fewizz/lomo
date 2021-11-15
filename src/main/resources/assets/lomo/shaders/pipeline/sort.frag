#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl
#include lomo:shaders/lib/blend.glsl

/* lomo:pipeline/sort.frag */

uniform sampler2D u_solid;
uniform sampler2D u_translucent;
uniform sampler2D u_entity;
uniform sampler2D u_weather;
uniform sampler2D u_cloud;
uniform sampler2D u_particle;

uniform sampler2D u_index_to_type;

layout(location = 0) out vec4 out_color;

void main() {
	ivec2 coord = ivec2(gl_FragCoord.xy);

	vec4 colors[6] = vec4[](
		texelFetch(u_solid, coord, 0),
		texelFetch(u_translucent, coord, 0),
		texelFetch(u_entity, coord, 0),
		texelFetch(u_weather, coord, 0),
		texelFetch(u_cloud, coord, 0),
		texelFetch(u_particle, coord, 0)
	);

	uint index_to_type = floatBitsToUint(texelFetch(u_index_to_type, coord, 0).r);
	uint indices[6];

	for(uint i = 0u; i < 6u; i++) {
		indices[i] = (index_to_type >> (4u*i)) & 0xFu;
	}

	vec3 result = colors[indices[5]].rgb;

	for (int i = 4; i >= 0; --i) {
		result = blend(result, colors[indices[i]]);
	}

	out_color = vec4(result, 1.0);
}


