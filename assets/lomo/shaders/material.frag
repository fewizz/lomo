#include canvas:shaders/pipeline/fog.glsl
#include canvas:shaders/pipeline/diffuse.glsl
#include canvas:shaders/pipeline/glint.glsl
#include frex:shaders/lib/math.glsl
#include frex:shaders/lib/color.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/player.glsl
#include frex:shaders/api/material.glsl
#include frex:shaders/api/fragment.glsl
#include lomo:shaders/lib/pack.glsl
#include lomo:shaders/lib/compute_normal.glsl

uniform samplerCube u_skybox;

layout(location = 0) out vec4 out_color;
layout(location = 1) out uvec4 out_data;

void frx_pipelineFragment() {
	vec3 vertex_normal = frx_vertexNormal;

	vertex_normal = normalize(vertex_normal);
	vec3 tangent = normalize(frx_vertexTangent.xyz);
	mat3 TBN = mat3(
		tangent,
		cross(vertex_normal, tangent),
		vertex_normal
	);

	vec3 frag_normal = TBN * frx_fragNormal;
	if(!frx_isHand) {
		frag_normal = mat3(frx_viewMatrix) * frag_normal;
	}

	frx_fragColor.rgb = pow(frx_fragColor.rgb, vec3(2.2));
	vec4 a = frx_fragColor;

	vec2 prev_light = frx_fragLight.xy;
	//frx_fragLight.xy = (frx_fragLight.xy - 0.03125) / (1.0 - 0.03125 - (1.0 - 0.96875));

	if (frx_isGui && !frx_isHand) {
		if (frx_fragEnableDiffuse) {
			float light = 0.4
				+ 0.6 * clamp(dot(vertex_normal.xyz, vec3(-0.93205774, 0.26230583, -0.24393857)), 0.0, 1.0)
				+ 0.6 * clamp(dot(vertex_normal.xyz, vec3(-0.10341814, 0.9751613, 0.18816751)), 0.0, 1.0);
			float df = min(light, 1.0);
			df = df + (1.0 - df) * frx_fragEmissive;
			a *= vec4(df, df, df, 1.0);
		}
	} else {
		float ao = pow(frx_fragLight.z, 3.0);
		a.rgb *= frx_fragEnableAo ? vec3(ao) : vec3(1.0);

		vec3 dir; {
			vec3 ndc_near = vec3(gl_FragCoord.xy, 0.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;
			vec3 ndc_far  = vec3(gl_FragCoord.xy, 1.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;

			vec4 near0 = frx_inverseProjectionMatrix * vec4(ndc_near, 1.0);
			vec4 far0  = frx_inverseProjectionMatrix * vec4(ndc_far, 1.0);
			vec3 near = near0.xyz / near0.w;
			vec3 far  = far0.xyz  / far0.w;
			dir = normalize(far - near);
		}

		vec3 reflect_dir = reflect(dir, frag_normal);
		vec3 sky = textureLod(
			u_skybox,
			mat3(frx_inverseViewMatrix) * normalize(mix(reflect_dir, frag_normal, frx_fragRoughness)),
			pow(frx_fragRoughness, 1.0 / 4.0) * 7.0
		).rgb;
		vec3 block = texture(frxs_lightmap, vec2(prev_light.x, 0.03125)).rgb;

		a.rgb *= mix(
			pow(frx_fragLight.y, 4.0) * sky + pow(frx_fragLight.x, 4.0) * block,
			frx_emissiveColor.rgb,
			frx_fragEmissive
		);
	}

	if (frx_matFlash == 1) {
		a = a * 0.25 + 0.75;
	} else if (frx_matHurt == 1) {
		a = vec4(0.25 + a.r * 0.75, a.g * 0.75, a.b * 0.75, a.a);
	}

	glintify(a, float(frx_matGlint));

	out_color = p_fog(a);
	out_color.rgb = pow(out_color.rgb, vec3(1.0 / 2.2));

	uvec4 data; {
		vec3 fn = frag_normal * 0.5 + 0.5;
		uint fx = pack(fn.x, 12u);
		uint fy = pack(fn.y, 12u);
		uint fz = pack(fn.z, 12u);

		vec3 vn = vertex_normal * 0.5 + 0.5;
		uint vx = pack(vn.x, 12u);
		uint vy = pack(vn.y, 12u);
		uint vz = pack(vn.z, 12u);

		vec3 e = frx_emissiveColor.rgb;
		uint er = pack(e.r, 5u);
		uint eg = pack(e.g, 5u);
		uint eb = pack(e.b, 5u);

		uint roughness  = pack(frx_fragRoughness, 8u);
		uint emissive   = pack(frx_fragEmissive, 8u);
		uint reflectace = pack(frx_fragReflectance, 8u);
		uint block      = pack(frx_fragLight.x, 8u);
		uint sky        = pack(frx_fragLight.y, 8u);

		data = uvec4(
			fy | (fx << 12) | (emissive   << (12 + 12)),
			vy | (vx << 12) | (roughness  << (12 + 12)),
			vz | (fz << 12) | (reflectace << (12 + 12)),
			1u | (block << 1) | (sky << (1 + 8)) |
				(er << (1 + 8 + 8)) |
				(eg << (1 + 8 + 8 + 5)) |
				(eb << (1 + 8 + 8 + 5 + 5))
		);
	}

	out_data = uvec4(data);

	gl_FragDepth = gl_FragCoord.z;
}