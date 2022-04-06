#include canvas:shaders/pipeline/diffuse.glsl
#include canvas:shaders/pipeline/glint.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/player.glsl
#include frex:shaders/api/material.glsl

#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/lomo.frag */

layout(location = 0) out vec4 out_color;
layout(location = 1) out vec4 out_normal;
layout(location = 2) out vec4 out_geometric_normal;
layout(location = 3) out vec4 out_extra_0;
layout(location = 4) out vec4 out_extra_1;

void frx_pipelineFragment() {
	vec4 a = frx_fragColor;

	if (frx_isGui && !frx_isHand) {
		if (frx_fragEnableDiffuse) {
			float df = p_diffuseGui(frx_vertexNormal);
			df = df + (1.0 - df) * frx_fragEmissive;
			a *= vec4(df, df, df, 1.0);
		}
	}

	out_color = a;

	if(
		frx_renderTargetSolid ||
		frx_renderTargetTranslucent ||
		frx_renderTargetParticles ||
		frx_renderTargetEntity
	) {
		vec3 geometric_normal = normalize(frx_vertexNormal);

		if(frag_normal == vec3(0.0)) frag_normal = geometric_normal;

		if(!frx_isHand) {
			frag_normal = raw_normal_to_cam(frag_normal);
			geometric_normal = raw_normal_to_cam(geometric_normal);
		}

		out_geometric_normal = vec4(geometric_normal, 1.0);
		out_normal = vec4(frag_normal, 1.0);
		out_extra_0 = vec4(roughness, frx_fragLight.y, frx_fragEmissive, 1.0);
		//out_extra_1 = vec4(0.0);
	}
	else {
		out_geometric_normal = vec4(0.0);
		out_normal = vec4(0);
		out_extra_0 = vec4(0);
		//out_extra_1 = vec4(0);
	}

	gl_FragDepth = gl_FragCoord.z;
}
